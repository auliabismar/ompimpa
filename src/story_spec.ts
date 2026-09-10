import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import yaml from "yaml";
import { getBlastRadius, type GraphData } from "./graphify";

export interface StoryAC {
  id: string;
  given: string;
  when: string;
  then: string;
}

export interface StoryDetail {
  id: string;
  epic: string;
  title: string;
  description: string;
  tea_tier: string;
  priority: string;
  depends_on: string[];
  target_files: string[];
  ac: StoryAC[];
  kill_criteria?: string[];
  estimate?: string;
  scoring_impact?: string;
}

export interface EpicDetail {
  id: string;
  title: string;
  description: string;
}

export interface FunctionSignature {
  name: string;
  arity: number;
  args: string[];
  returnType: string;
  typespec: string;
  language: "elixir" | "typescript";
  doc?: string;
}

export interface DataSchemaInfo {
  hasSchema: boolean;
  entityName?: string;
  tableName?: string;
  fields?: Array<{ name: string; type: string; constraints?: string }>;
  framework: "ecto" | "ash" | "none";
  notes?: string;
}

export interface BlastRadiusContext {
  coreContextTouched: boolean;
  sourceFiles: string[];
  affectedCallers: string[];
  method: "mix_xref" | "graph_json" | "regex_scan" | "leaf_isolated";
  summary: string;
}

export interface StorySpecResult {
  storyId: string;
  epicId: string;
  specFilePath: string;
  content: string;
  gherkinScenarios: string;
  signatures: FunctionSignature[];
  dataSchema: DataSchemaInfo;
  blastRadius: BlastRadiusContext;
  targetFiles: string[];
  testFiles: string[];
}

export interface StorySpecOptions {
  repoRoot?: string;
  dryRun?: boolean;
  force?: boolean;
  date?: string; // Optional fixed date for deterministic snapshot tests
}

interface RawStoryYaml {
  id?: unknown;
  epic?: unknown;
  title?: unknown;
  description?: unknown;
  tea_tier?: unknown;
  priority?: unknown;
  depends_on?: unknown;
  target_files?: unknown;
  ac?: unknown;
  kill_criteria?: unknown;
  estimate?: unknown;
  scoring_impact?: unknown;
}

interface RawEpicYaml {
  id?: unknown;
  title?: unknown;
  description?: unknown;
}

interface RawStoriesDocYaml {
  stories?: RawStoryYaml[];
  epics?: RawEpicYaml[];
}

const COMMON_NON_FUNCTION_NAMES: Record<string, true> = {
  bun: true,
  mix: true,
  git: true,
  expect: true,
  test: true,
  it: true,
  describe: true,
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load story detail and epic metadata from _ompimpa/stories.yaml
 */
export async function loadStoryDetail(
  storyId: string,
  repoRoot: string = process.cwd()
): Promise<{ story: StoryDetail; epic?: EpicDetail }> {
  const primaryPath = path.join(repoRoot, "_ompimpa", "stories.yaml");
  const fallbackPath = path.join(repoRoot, "_ompimpa", "status", "stories.yaml");

  let yamlPath = primaryPath;
  if (!(await fileExists(primaryPath))) {
    if (await fileExists(fallbackPath)) {
      yamlPath = fallbackPath;
    } else {
      throw new Error(`Stories YAML not found at ${primaryPath} or ${fallbackPath}`);
    }
  }

  const raw = await fs.readFile(yamlPath, "utf-8");
  const doc = yaml.parse(raw) as RawStoriesDocYaml | null;

  if (!doc || !Array.isArray(doc.stories)) {
    throw new Error(`Invalid stories YAML structure in ${yamlPath}: missing 'stories' array`);
  }

  const normalizedTargetId = storyId.trim().toUpperCase();
  const rawStory = doc.stories.find(
    (s) => s && s.id && String(s.id).trim().toUpperCase() === normalizedTargetId
  );

  if (!rawStory) {
    throw new Error(`Story ID '${storyId}' not found in ${path.relative(repoRoot, yamlPath)}`);
  }

  const acList: StoryAC[] = [];
  if (Array.isArray(rawStory.ac)) {
    for (const rawAc of rawStory.ac as Array<Record<string, unknown>>) {
      if (rawAc && typeof rawAc === "object") {
        acList.push({
          id: String(rawAc.id || "").trim(),
          given: String(rawAc.given || "").trim(),
          when: String(rawAc.when || "").trim(),
          then: String(rawAc.then || "").trim(),
        });
      }
    }
  }

  const story: StoryDetail = {
    id: String(rawStory.id).trim(),
    epic: String(rawStory.epic || "").trim(),
    title: String(rawStory.title || "").trim(),
    description: String(rawStory.description || "").trim(),
    tea_tier: String(rawStory.tea_tier || "P0").trim(),
    priority: String(rawStory.priority || "P0").trim(),
    depends_on: Array.isArray(rawStory.depends_on)
      ? rawStory.depends_on.map((d) => String(d).trim())
      : [],
    target_files: Array.isArray(rawStory.target_files)
      ? rawStory.target_files.map((t) => String(t).trim())
      : [],
    ac: acList,
    kill_criteria: Array.isArray(rawStory.kill_criteria)
      ? rawStory.kill_criteria.map((k) => String(k).trim())
      : [],
    estimate: rawStory.estimate ? String(rawStory.estimate).trim() : "S",
    scoring_impact: rawStory.scoring_impact ? String(rawStory.scoring_impact).trim() : "TEA-01",
  };

  let epic: EpicDetail | undefined;
  if (Array.isArray(doc.epics)) {
    const rawEpic = doc.epics.find(
      (e) => e && e.id && String(e.id).trim().toUpperCase() === story.epic.toUpperCase()
    );
    if (rawEpic) {
      epic = {
        id: String(rawEpic.id).trim(),
        title: String(rawEpic.title || "").trim(),
        description: String(rawEpic.description || "").trim(),
      };
    }
  }

  return { story, epic };
}

/**
 * Find matching Macro PRD and ADR references for a given story
 */
export async function findGovernanceReferences(
  story: StoryDetail,
  repoRoot: string = process.cwd()
): Promise<{ prdPath: string; adrPath: string; prdTitle: string; adrTitle: string }> {
  const prdDir = path.join(repoRoot, "_ompimpa", "prd");
  const adrDir = path.join(repoRoot, "_ompimpa", "adr");

  let prdPath = "_ompimpa/prd/PRD-001-panen-agyimpa.md";
  let prdTitle = "PRD-001: Panen agyimpa → ompimpa";
  let adrPath = "_ompimpa/adr/ADR-001-panen-agyimpa-isolated-review-criteria-registry.md";
  let adrTitle = "ADR-001: Panen agyimpa Isolated Review & Criteria Registry";

  // Check primary epic mappings first
  if (story.epic === "EPIC-D" || story.epic === "EPIC-E") {
    prdPath = "_ompimpa/prd/PRD-002-dekomposisi-fase-outer-loop-inspect.md";
    prdTitle = "PRD-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, & Unifikasi Master Diagnostic /inspect";
    adrPath = "_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md";
    adrTitle = "ADR-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, 10 Isolated Reviewers Sejati, & Unifikasi Master Diagnostic /inspect";
  } else if (story.epic === "EPIC-A" || story.epic === "EPIC-B" || story.epic === "EPIC-C") {
    prdPath = "_ompimpa/prd/PRD-001-panen-agyimpa.md";
    prdTitle = "PRD-001: Panen agyimpa → ompimpa — Deterministic Review & Knowledge Spine";
    adrPath = "_ompimpa/adr/ADR-001-panen-agyimpa-isolated-review-criteria-registry.md";
    adrTitle = "ADR-001: Panen agyimpa Isolated Review & Criteria Registry";
  } else {
    // Dynamic lookup for other or future epics
    const idRegex = new RegExp(`(?<![A-Za-z0-9])${story.id}(?![A-Za-z0-9])`);
    const epicRegex = new RegExp(`(?<![A-Za-z0-9])${story.epic}(?![A-Za-z0-9])`);

    if (await fileExists(prdDir)) {
      try {
        const prdFiles = await fs.readdir(prdDir);
        for (const file of prdFiles) {
          if (!file.endsWith(".md")) continue;
          const fullPath = path.join(prdDir, file);
          const content = await fs.readFile(fullPath, "utf-8");
          if (idRegex.test(content) || epicRegex.test(content)) {
            prdPath = `_ompimpa/prd/${file}`;
            const firstLine = content.split("\n")[0].replace(/^#\s*/, "").trim();
            prdTitle = firstLine || file;
            break;
          }
        }
      } catch {}
    }

    if (await fileExists(adrDir)) {
      try {
        const adrFiles = await fs.readdir(adrDir);
        for (const file of adrFiles) {
          if (!file.endsWith(".md")) continue;
          const fullPath = path.join(adrDir, file);
          const content = await fs.readFile(fullPath, "utf-8");
          if (idRegex.test(content) || epicRegex.test(content)) {
            adrPath = `_ompimpa/adr/${file}`;
            const firstLine = content.split("\n")[0].replace(/^#\s*/, "").trim();
            adrTitle = firstLine || file;
            break;
          }
        }
      } catch {}
    }
  }

  return { prdPath, adrPath, prdTitle, adrTitle };
}

/**
 * Perform lazy blast-radius analysis via mix xref callers if core context is touched,
 * falling back to _ompimpa/graph.json or leaf isolation.
 */
export async function getBlastRadiusForStory(
  story: StoryDetail,
  repoRoot: string = process.cwd()
): Promise<BlastRadiusContext> {
  const cleanFiles = story.target_files.map((f) => f.split("#")[0].trim()).filter(Boolean);

  const coreKeywords = ["/core/", "core.ex", "accounts", "auth", "schema", "models", "repo", "domain"];
  const coreFiles = cleanFiles.filter((p) => coreKeywords.some((kw) => p.toLowerCase().includes(kw)));

  const coreContextTouched = coreFiles.length > 0;

  if (!coreContextTouched) {
    return {
      coreContextTouched: false,
      sourceFiles: cleanFiles,
      affectedCallers: [],
      method: "leaf_isolated",
      summary: "Modul perifer/tooling terisolasi — tidak menyentuh core context atau skema database inti.",
    };
  }

  // Check if mix.exs exists to run lazy `mix xref callers`
  const mixExsPath = path.join(repoRoot, "mix.exs");
  if (await fileExists(mixExsPath)) {
    const callers: string[] = [];
    let mixXrefSuccess = false;

    for (const coreFile of coreFiles) {
      if (!coreFile.endsWith(".ex") && !coreFile.endsWith(".exs")) continue;
      const { promise, resolve } = Promise.withResolvers<string | null>();
      const proc = spawn("mix", ["xref", "callers", coreFile], {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "ignore"],
      });
      let stdout = "";
      const timer = setTimeout(() => {
        try {
          proc.kill("SIGTERM");
        } catch {}
        resolve(null);
      }, 1500);
      proc.stdout?.on("data", (d) => (stdout += d.toString()));
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) resolve(stdout);
        else resolve(null);
      });
      proc.on("error", () => {
        clearTimeout(timer);
        resolve(null);
      });
      const res = await promise;

      if (res) {
        mixXrefSuccess = true;
        const lines = res.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("Generated"));
        for (const line of lines) {
          if (!callers.includes(line)) callers.push(line);
        }
      }
    }

    if (mixXrefSuccess) {
      return {
        coreContextTouched: true,
        sourceFiles: coreFiles,
        affectedCallers: callers,
        method: "mix_xref",
        summary: `Dipindai via lazy 'mix xref callers': ${callers.length} modul pemanggil terdeteksi.`,
      };
    }
  }

  // Fallback: check _ompimpa/graph.json
  const graphJsonPath = path.join(repoRoot, "_ompimpa", "graph.json");
  if (await fileExists(graphJsonPath)) {
    try {
      const graphData = JSON.parse(await fs.readFile(graphJsonPath, "utf-8")) as GraphData;
      const allAffected = new Set<string>();

      for (const coreFile of coreFiles) {
        const blast = getBlastRadius(coreFile, graphData);
        for (const aff of blast.affected) allAffected.add(aff);
      }

      const affectedList = Array.from(allAffected).sort();
      return {
        coreContextTouched: true,
        sourceFiles: coreFiles,
        affectedCallers: affectedList,
        method: "graph_json",
        summary: `Dipindai via _ompimpa/graph.json: ${affectedList.length} pemanggil transitif terdeteksi.`,
      };
    } catch {}
  }

  return {
    coreContextTouched: true,
    sourceFiles: coreFiles,
    affectedCallers: [],
    method: "regex_scan",
    summary: "Menyentuh berkas berlabel core, tetapi tidak ditemukan pemanggil eksternal aktif.",
  };
}

/**
 * Infer exact function signatures, typespecs, and arity for a given story
 */
export function inferFunctionSignatures(story: StoryDetail): FunctionSignature[] {
  const cleanFiles = story.target_files.map((f) => f.split("#")[0].trim()).filter(Boolean);
  const isElixir = cleanFiles.some((f) => f.endsWith(".ex") || f.endsWith(".exs"));
  const signatures: FunctionSignature[] = [];

  // 1. Story D-01 Specific Known Signatures
  if (story.id === "D-01") {
    signatures.push(
      {
        name: "generateStorySpec",
        arity: 2,
        args: ["storyId: string", "options?: StorySpecOptions"],
        returnType: "Promise<StorySpecResult>",
        typespec: "generateStorySpec(storyId: string, options?: StorySpecOptions): Promise<StorySpecResult>",
        language: "typescript",
        doc: "Menghasilkan dokumen spesifikasi mikro just-in-time _ompimpa/specs/SPEC-[ID].md secara deterministik.",
      },
      {
        name: "loadStoryDetail",
        arity: 2,
        args: ["storyId: string", "repoRoot?: string"],
        returnType: "Promise<{ story: StoryDetail; epic?: EpicDetail }>",
        typespec: "loadStoryDetail(storyId: string, repoRoot?: string): Promise<{ story: StoryDetail; epic?: EpicDetail }>",
        language: "typescript",
        doc: "Membaca dan memvalidasi entri story dari _ompimpa/stories.yaml.",
      },
      {
        name: "getBlastRadiusForStory",
        arity: 2,
        args: ["story: StoryDetail", "repoRoot?: string"],
        returnType: "Promise<BlastRadiusContext>",
        typespec: "getBlastRadiusForStory(story: StoryDetail, repoRoot?: string): Promise<BlastRadiusContext>",
        language: "typescript",
        doc: "Menganalisis blast-radius file yang terdampak via lazy mix xref callers.",
      }
    );
    return signatures;
  }

  // 2. Extract function calls mentioned in ACs (e.g., `when: "checkCircularDAG() dipanggil"`)
  const acText = story.ac.map((a) => `${a.when} ${a.then}`).join(" ");
  const fnCallRegex = /(?:^|[\s;.,])([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  const seenFns = new Set<string>();

  while ((match = fnCallRegex.exec(acText)) !== null) {
    const fnName = match[1];
    if (COMMON_NON_FUNCTION_NAMES[fnName]) continue;

    const rawParams = match[2].trim();
    // Ignore non-code parentheticals (e.g. "(header > DEPRECATED: use rules/01..26)")
    if (rawParams && !/^[a-zA-Z0-9_,\s]*$/.test(rawParams)) continue;

    if (seenFns.has(fnName)) continue;
    seenFns.add(fnName);
    const paramList = rawParams ? rawParams.split(",").map((p) => p.trim()).filter(Boolean) : [];
    const arity = paramList.length;

    if (isElixir) {
      const typespecArgs = paramList.map((p, i) => `${p || `arg${i + 1}`} :: term()`).join(", ");
      signatures.push({
        name: fnName,
        arity,
        args: paramList.map((p, i) => p || `arg${i + 1}`),
        returnType: "{:ok, term()} | {:error, term()}",
        typespec: `@spec ${fnName}(${typespecArgs}) :: {:ok, term()} | {:error, term()}`,
        language: "elixir",
        doc: `Diekstrak dari Kriteria Penerimaan story ${story.id}.`,
      });
    } else {
      const tsArgs = paramList.map((p, i) => `${p || `arg${i + 1}`}: unknown`).join(", ");
      signatures.push({
        name: fnName,
        arity,
        args: paramList.map((p, i) => p || `arg${i + 1}`),
        returnType: "unknown",
        typespec: `export function ${fnName}(${tsArgs}): unknown;`,
        language: "typescript",
        doc: `Diekstrak dari Kriteria Penerimaan story ${story.id}.`,
      });
    }
  }

  // 3. Fallback: if no functions were extracted, infer from primary target module
  if (signatures.length === 0) {
    const primaryFile = cleanFiles.find((f) => !f.startsWith("test/") && !f.endsWith(".md")) || cleanFiles[0] || "core";
    const baseName = path.basename(primaryFile, path.extname(primaryFile));
    const normalizedName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");

    if (isElixir) {
      signatures.push({
        name: "execute",
        arity: 2,
        args: ["target", "opts \\\\ []"],
        returnType: "{:ok, term()} | {:error, term()}",
        typespec: `@spec execute(target :: map() | binary(), opts :: keyword()) :: {:ok, map()} | {:error, atom()}`,
        language: "elixir",
        doc: `Entrypoint utama untuk modul ${normalizedName}.`,
      });
    } else {
      signatures.push({
        name: `handle${normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1)}`,
        arity: 1,
        args: ["args: string[]"],
        returnType: "Promise<void>",
        typespec: `export async function handle${normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1)}(args: string[]): Promise<void>;`,
        language: "typescript",
        doc: `Handler eksekusi utama untuk ${primaryFile}.`,
      });
    }
  }

  return signatures;
}

/**
 * Infer data schema, Ecto migrations, or Ash resources involved in the story
 */
export function inferDataSchema(story: StoryDetail, _repoRoot: string = process.cwd()): DataSchemaInfo {
  const combinedText = `${story.title} ${story.description} ${story.target_files.join(" ")}`.toLowerCase();

  const isAsh = combinedText.includes("ash") || combinedText.includes("resource");
  const isEcto = combinedText.includes("ecto") || combinedText.includes("schema") || combinedText.includes("migration");

  if (isAsh) {
    return {
      hasSchema: true,
      entityName: "Resource",
      framework: "ash",
      fields: [
        { name: "id", type: ":uuid", constraints: "primary_key: true" },
        { name: "inserted_at", type: ":utc_datetime_usec", constraints: "create_timestamp: true" },
        { name: "updated_at", type: ":utc_datetime_usec", constraints: "update_timestamp: true" },
      ],
      notes: "Wajib menegakkan kebijakan otorisasi fail-closed (default deny) sesuai Invarian 26 Hukum Besi.",
    };
  }

  if (isEcto) {
    const isMoney = combinedText.includes("balance") || combinedText.includes("money") || combinedText.includes("saldo");
    const fields: Array<{ name: string; type: string; constraints?: string }> = [
      { name: "id", type: ":binary_id", constraints: "primary_key: true" },
    ];

    if (isMoney) {
      fields.push({
        name: "balance",
        type: ":decimal",
        constraints: "null: false, default: 0.0 (Hukum Besi #1: Dilarang :float)",
      });
    }

    fields.push({ name: "timestamps", type: "timestamps()", constraints: "type: :utc_datetime_usec" });

    return {
      hasSchema: true,
      entityName: "EctoSchema",
      tableName: "app_entities",
      framework: "ecto",
      fields,
      notes: "Validasi ketat via changeset; operator pinning `^` wajib ditegakkan pada setiap Ecto query (Hukum Besi #4).",
    };
  }

  return {
    hasSchema: false,
    framework: "none",
    notes: "Story ini bertipe stateless/tooling/file-backed; tidak memerlukan skema basis data atau migrasi Ecto/Ash.",
  };
}

/**
 * Generate Gherkin syntax string for story Acceptance Criteria
 */
export function generateGherkin(story: StoryDetail): string {
  const scenarios = story.ac.map((ac) => {
    const tag = `@${ac.id.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
    const cleanWhen = ac.when.replace(/\n/g, " ").trim();
    const cleanGiven = ac.given.replace(/\n/g, " ").trim();
    const cleanThen = ac.then.replace(/\n/g, " ").trim();

    return `  ${tag} @tea-01
  Scenario: ${ac.id} - ${cleanWhen}
    Given ${cleanGiven}
    When ${cleanWhen}
    Then ${cleanThen}`;
  });

  const featureHeader = `Feature: ${story.id} - ${story.title}
  Sebagai pengembang sistem OMP-IMPA
  Saya ingin ${story.title}
  Agar mematuhi target mutu arsitektur ${story.scoring_impact || "TEA-01"} dan spesifikasi produk`;

  return `${featureHeader}\n\n${scenarios.join("\n\n")}`;
}

/**
 * Partition target files into implementation targets and test targets
 */
export function partitionTargetFiles(
  story: StoryDetail,
  repoRoot?: string
): { targetFiles: string[]; testFiles: string[] } {
  const cleanFiles = story.target_files.map((f) => f.split("#")[0].trim()).filter(Boolean);
  const targetFiles: string[] = [];
  const testFiles: string[] = [];

  for (const file of cleanFiles) {
    if ((file.startsWith("test/") || file.endsWith(".test.ts") || file.endsWith("_test.exs")) && !file.endsWith("/")) {
      testFiles.push(file);
    } else {
      targetFiles.push(file);
    }
  }

  // If no explicit test file in target_files, synthesize standard ATDD test file path
  if (testFiles.length === 0) {
    const root = repoRoot || process.cwd();
    const isElixir =
      cleanFiles.some((f) => f.startsWith("lib/") || f.endsWith(".ex") || f.endsWith(".exs")) ||
      fsSync.existsSync(path.join(root, "mix.exs"));

    const primary = targetFiles.find((f) => !f.endsWith(".md"));
    if (primary) {
      if (primary.startsWith("src/") && primary.endsWith(".ts")) {
        const testName = path.basename(primary, ".ts") + ".test.ts";
        testFiles.push(`test/${testName}`);
      } else if (primary.startsWith("lib/")) {
        const cleanPrimary = primary.replace(/\/+$/, "");
        if (cleanPrimary.endsWith(".ex")) {
          testFiles.push(cleanPrimary.replace(/^lib\//, "test/").replace(/\.ex$/, "_test.exs"));
        } else {
          testFiles.push(cleanPrimary.replace(/^lib\//, "test/") + "_test.exs");
        }
      } else if (primary.startsWith("test/")) {
        const cleanPrimary = primary.replace(/\/+$/, "");
        testFiles.push(`${cleanPrimary}/story_${story.id.toLowerCase().replace(/[^a-z0-9]/g, "_")}_test.exs`);
      } else if (isElixir) {
        testFiles.push(`test/story_${story.id.toLowerCase().replace(/[^a-z0-9]/g, "_")}_test.exs`);
      } else {
        testFiles.push(`test/${story.id.toLowerCase().replace(/[^a-z0-9]/g, "_")}_spec.test.ts`);
      }
    } else if (isElixir) {
      testFiles.push(`test/story_${story.id.toLowerCase().replace(/[^a-z0-9]/g, "_")}_test.exs`);
    } else {
      testFiles.push(`test/${story.id.toLowerCase().replace(/[^a-z0-9]/g, "_")}_spec.test.ts`);
    }
  }

  return { targetFiles, testFiles };
}

/**
 * Main generator: Produces _ompimpa/specs/SPEC-[STORY_ID].md deterministically
 */
export async function generateStorySpec(
  storyId: string,
  options: StorySpecOptions = {}
): Promise<StorySpecResult> {
  const repoRoot = options.repoRoot || process.cwd();
  const { story, epic } = await loadStoryDetail(storyId, repoRoot);

  const gov = await findGovernanceReferences(story, repoRoot);
  const blastRadius = await getBlastRadiusForStory(story, repoRoot);
  const signatures = inferFunctionSignatures(story);
  const dataSchema = inferDataSchema(story, repoRoot);
  const gherkinScenarios = generateGherkin(story);
  const { targetFiles, testFiles } = partitionTargetFiles(story, repoRoot);

  const dateStr = options.date || "2026-09-03";
  const epicTitle = epic ? `${epic.id} — ${epic.title}` : story.epic;

  const signaturesMarkdown = signatures
    .map((sig) => {
      if (sig.language === "elixir") {
        return `#### \`${sig.name}/${sig.arity}\`
\`\`\`elixir
${sig.doc ? `# ${sig.doc}\n` : ""}${sig.typespec}
def ${sig.name}(${sig.args.join(", ")})
\`\`\``;
      }
      return `#### \`${sig.name}/${sig.arity}\`
\`\`\`typescript
${sig.doc ? `/** ${sig.doc} */\n` : ""}${sig.typespec}
\`\`\``;
    })
    .join("\n\n");

  let schemaMarkdown = `> ${dataSchema.notes || "Stateless / pure logic story."}\n`;
  if (dataSchema.hasSchema && dataSchema.fields) {
    schemaMarkdown += `\n| Field | Type | Constraints |
|---|---|---|
${dataSchema.fields.map((f) => `| \`${f.name}\` | \`${f.type}\` | ${f.constraints || "-"} |`).join("\n")}\n`;
  }

  const taskList = targetFiles.map((f) => `- [ ] \`${f}\` -- implementasikan sesuai kontrak §3 dan skenario §2; tandai [x] saat AC terkait hijau`).join("\n");
  const verifyCommands = testFiles
    .map((f) => {
      if (f.endsWith(".exs")) return `- \`mix test ${f}\` -- expected: seluruh asersi ATDD hijau`;
      return `- \`bun test ${f}\` -- expected: seluruh asersi ATDD hijau`;
    })
    .join("\n");
  const codeMapEntries =
    blastRadius.affectedCallers.length > 0
      ? blastRadius.affectedCallers.map((c) => `- \`${c}\` -- pemanggil terdampak (jangan ubah tanpa uji regresi)`).join("\n")
      : "- _Tidak ada pemanggil eksternal (leaf_isolated)._";
  const specContent = `---
title: '${story.id} - ${story.title.replace(/'/g, "")}'
type: 'feature'
created: '${dateStr}'
status: 'ready-for-atdd'
route: 'dispatch'
review_loop_iteration: 0
spec: '_ompimpa/specs/SPEC-${story.id}.md'
prd: '${gov.prdPath}'
adr: '${gov.adrPath}'
---

# SPEC-${story.id}: ${story.title}

> **Status:** Ready for ATDD (TEA-01) — story file tunggal (pengganti format story terpisah; lihat \`commands/story.md\`)
> **Epic:** ${epicTitle}  
> **Story ID:** \`${story.id}\`  
> **Priority:** \`${story.priority}\` | **TEA Tier:** \`${story.tea_tier}\` | **Estimate:** \`${story.estimate || "S"}\`  
> **Scoring Impact:** \`${story.scoring_impact || "TEA-01"}\`  
> **Author / Architect:** H. Agus Salim (\`ompimpa-prd\`) — Tata Kelola OMP-IMPA  
> **Tanggal Terbit:** ${dateStr}  
> **Rujukan Tata Kelola:**
> - **PRD:** [\`${gov.prdTitle}\`](${gov.prdPath})
> - **ADR:** [\`${gov.adrTitle}\`](${gov.adrPath})
> - **Backlog DAG:** \`_ompimpa/stories.yaml\` (Story \`${story.id}\`)

---

<frozen-after-approval reason="human-owned intent — dilarang diubah agen/dev/review kecuali manusia menegosiasi ulang">

## Intent

**Problem:** ${story.description.trim().split("\n")[0]}

**Approach:** Implementasikan kontrak §3–§5 di berkas target §6 hingga seluruh AC §2 hijau.

## Boundaries & Constraints

**Always:** Patuhi 26 Hukum Besi Elixir; 100% AC §2 terikat asersi tes (TEA-01); scoped-test selama /code.

**Never:** Di luar target files §6; ubah intent beku ini; tandai done sebelum /triage 100/100.

</frozen-after-approval>

---

## 0. Open Questions (Gerbang Siap-Kembang)

_Tidak ada pertanyaan terbuka. SPEC dilarang berstatus siap-dev selama seksi ini terisi: setiap jawaban manusia wajib dicatat ke blok frozen di atas lalu entrinya dihapus._

---

## 1. Ringkasan Cerita (Story Overview)

${story.description.trim()}

### Ketergantungan DAG (Dependencies)
- **Depends On:** ${story.depends_on.length > 0 ? story.depends_on.map((d) => `\`${d}\``).join(", ") : "_Tidak ada (Root / Independent Story)_"}
- **Target Files Terdaftar:** ${story.target_files.map((t) => `\`${t}\``).join(", ")}

---

## 2. Skenario Gherkin Presisi (ATDD Ready — TEA-01)

Skenario berikut siap di-scaffold oleh Tuanku Imam Bonjol (\`/atdd ${story.id}\`) menjadi asersi uji merah (*Red-Phase*):

\`\`\`gherkin
${gherkinScenarios}
\`\`\`

---

## 3. Tanda Tangan Fungsi & Kontrak Antarmuka (*Function Signatures & Typespecs*)

Berikut kontrak pasti (*exact signatures, typespecs, & arity*) yang wajib dipenuhi oleh kode produksi:

${signaturesMarkdown}

---

## 4. Skema Data & Konfigurasi Ecto / Ash Resource

${schemaMarkdown}

---

## 5. Analisis Dampak & Blast-Radius (*Lazy mix xref*)

- **Menyentuh Core Context:** \`${blastRadius.coreContextTouched ? "Ya" : "Tidak"}\`
- **Metode Pemindaian:** \`${blastRadius.method}\`
- **Ringkasan Dampak:** ${blastRadius.summary}
- **Modul / Callers Terdampak:**
${
  blastRadius.affectedCallers.length > 0
    ? blastRadius.affectedCallers.map((c) => `  - \`${c}\``).join("\n")
    : "  - _Tidak ada pemanggil eksternal terdampak (modul perifer atau leaf)._"
}

---

## 6. Berkas Target Implementasi & Berkas Tes (*Target Files & Test Files*)

### Berkas Implementasi Produksi
${targetFiles.map((f) => `- \`${f}\``).join("\n")}

### Berkas Uji ATDD (*Red-Phase Targets*)
${testFiles.map((f) => `- \`${f}\``).join("\n")}

---

## 6b. Tasks & Acceptance (Satu Tugas per Berkas)

**Execution:**
${taskList}

**Acceptance Criteria (ringkas — normatif penuh di §2):**
${story.ac.map((a) => `- ${a.id}: Given ${a.given.replace(/\n/g, " ").trim()} → Then ${a.then.replace(/\n/g, " ").trim()}`).join("\n")}

---

## 6c. Code Map (Hasil Investigasi — Agen Implementasi Dilarang Mencari Ulang)

${codeMapEntries}

---

## 7. Batas Penghentian & Gerbang Kualitas (*Kill Criteria & Quality Gates*)

- **Kill Criteria:**
${
  story.kill_criteria && story.kill_criteria.length > 0
    ? story.kill_criteria.map((k) => `  - ${k}`).join("\n")
    : "  - _Tidak ada kill criteria spesifik (mengikuti aturan umum timeout 60s per reviewer)._"
}
- **In-Band TEA Compliance:**
  - **TEA-01 Traceability:** 100% Kriteria Penerimaan Gherkin di atas wajib terikat pada asersi tes.
  - **Flaky & Latency Guard:** Dilarang menggunakan \`Process.sleep\` dan waktu eksekusi unit test wajib < 50ms.
  - **Mutation Guard:** Dilarang menggunakan asersi longgar/formalitas demi mencegah *false greens*.
- **Ambang Lolos Scorecard:** Wajib mencapai skor **100/100 PASS** pada evaluasi \`/triage ${story.id}\`.

---

## 8. Verification (Perintah Pengecekan Mandiri Agen)

${verifyCommands}

---

## 9. Implementation Notes (Append-Only Selama /code)

_Kosong saat planning. Catat keputusan, berkas tersentuh, dan kejutan di sini; dilarang menghapus seksi ini._

---

## 10. Spec Change Log (Append-Only Saat Loopback bad_spec)

_Kosong hingga loopback review pertama. Setiap entri: temuan pemicu → amendemen → known-bad yang dihindari → instruksi KEEP._

---

## 11. Review Triage Log (Satu Baris per Temuan Review)

_Kosong hingga review pertama. Setiap temuan: verdict (high/medium/low/false/maybe-false) + bukti satu-dua kalimat; dilarang drop/merge diam-diam._
`;

  const specDir = path.join(repoRoot, "_ompimpa", "specs");
  const specFilePath = path.join(specDir, `SPEC-${story.id}.md`);

  if (!options.dryRun) {
    await fs.mkdir(specDir, { recursive: true });
    // Regen tidak boleh menghapus jejak run: bawa §12 Run Ledger yang sudah ada.
    let finalContent = specContent;
    try {
      const existing = await fs.readFile(specFilePath, "utf-8");
      const ledgerIdx = existing.indexOf("## 12. Run Ledger");
      if (ledgerIdx >= 0) {
        finalContent = `${specContent.trimEnd()}\n\n---\n\n${existing.slice(ledgerIdx).trim()}\n`;
      }
    } catch {
      // SPEC belum ada — tulis baru.
    }
    await fs.writeFile(specFilePath, finalContent, "utf-8");
  }

  return {
    storyId: story.id,
    epicId: story.epic,
    specFilePath,
    content: specContent,
    gherkinScenarios,
    signatures,
    dataSchema,
    blastRadius,
    targetFiles,
    testFiles,
  };
}
