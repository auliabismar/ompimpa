import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import {
  loadStoryDetail,
  findGovernanceReferences,
  inferFunctionSignatures,
  inferDataSchema,
  generateGherkin,
  partitionTargetFiles,
  getBlastRadiusForStory,
  generateStorySpec,
  type StoryDetail,
} from "../src/story_spec";

const REPO_ROOT = path.resolve(import.meta.dir, "..");

async function runCli(
  args: string[],
  cwd: string = REPO_ROOT
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { promise, resolve } = Promise.withResolvers<{ code: number; stdout: string; stderr: string }>();
  const cliPath = path.join(REPO_ROOT, "src/cli.ts");
  const proc = spawn("bun", ["run", cliPath, ...args], { cwd, stdio: "pipe" });
  let stdout = "";
  let stderr = "";
  proc.stdout?.on("data", (d) => (stdout += d.toString()));
  proc.stderr?.on("data", (d) => (stderr += d.toString()));
  proc.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  return promise;
}

describe("Story D-01: Story JIT Spec Generator (/ompimpa:story)", () => {
  it("loadStoryDetail: membaca entri story D-01 dan epic EPIC-D secara akurat", async () => {
    const { story, epic } = await loadStoryDetail("D-01", REPO_ROOT);

    expect(story.id).toBe("D-01");
    expect(story.epic).toBe("EPIC-D");
    expect(story.title).toContain("Story JIT Spec Generator");
    expect(story.tea_tier).toBe("P0");
    expect(story.priority).toBe("P0");
    expect(story.depends_on).toContain("A-02");
    expect(story.target_files.some((f) => f.includes("commands/story.md"))).toBeTrue();
    expect(story.ac.length).toBeGreaterThanOrEqual(1);
    expect(story.ac[0].id).toBe("AC-D01-1");

    expect(epic).toBeDefined();
    expect(epic?.id).toBe("EPIC-D");
    expect(epic?.title).toContain("Outer Loop Driver");
  });

  it("loadStoryDetail: melempar error informatif jika story ID tidak ditemukan", async () => {
    try {
      await loadStoryDetail("UNKNOWN-999", REPO_ROOT);
      expect.unreachable("Seharusnya melempar error untuk story ID tidak valid");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain("UNKNOWN-999");
      expect(msg).toContain("not found");
    }
  });

  it("findGovernanceReferences: memetakan PRD-002 dan ADR-002 untuk EPIC-D", async () => {
    const { story } = await loadStoryDetail("D-01", REPO_ROOT);
    const gov = await findGovernanceReferences(story, REPO_ROOT);

    expect(gov.prdPath).toContain("PRD-002");
    expect(gov.adrPath).toContain("ADR-002");
    expect(gov.prdTitle).toContain("PRD-002");
    expect(gov.adrTitle).toContain("ADR-002");
  });

  it("findGovernanceReferences: memetakan PRD-001 dan ADR-001 untuk EPIC-A", async () => {
    const { story } = await loadStoryDetail("A-01", REPO_ROOT);
    const gov = await findGovernanceReferences(story, REPO_ROOT);

    expect(gov.prdPath).toContain("PRD-001");
    expect(gov.adrPath).toContain("ADR-001");
  });

  it("inferFunctionSignatures: menghasilkan signature TypeScript eksak untuk story D-01", async () => {
    const { story } = await loadStoryDetail("D-01", REPO_ROOT);
    const signatures = inferFunctionSignatures(story);

    expect(signatures.length).toBe(3);
    const names = signatures.map((s) => s.name);
    expect(names).toContain("generateStorySpec");
    expect(names).toContain("loadStoryDetail");
    expect(names).toContain("getBlastRadiusForStory");

    const genSig = signatures.find((s) => s.name === "generateStorySpec");
    expect(genSig?.arity).toBe(2);
    expect(genSig?.language).toBe("typescript");
    expect(genSig?.returnType).toBe("Promise<StorySpecResult>");
    expect(genSig?.typespec).toContain("generateStorySpec(storyId: string, options?: StorySpecOptions)");
  });

  it("inferFunctionSignatures: mengekstrak signature fungsi dari Kriteria Penerimaan story", async () => {
    const { story } = await loadStoryDetail("A-01", REPO_ROOT);
    const signatures = inferFunctionSignatures(story);

    const names = signatures.map((s) => s.name);
    expect(names).toContain("loadPrewalkRules");
    const prewalkSig = signatures.find((s) => s.name === "loadPrewalkRules");
    expect(prewalkSig?.arity).toBe(0);
  });

  it("inferDataSchema: mengenali story stateless / tooling tanpa basis data", async () => {
    const { story } = await loadStoryDetail("D-01", REPO_ROOT);
    const schema = inferDataSchema(story, REPO_ROOT);

    expect(schema.hasSchema).toBeFalse();
    expect(schema.framework).toBe("none");
    expect(schema.notes).toContain("stateless");
  });

  it("inferDataSchema: menegakkan aturan Ecto dan Hukum Besi #1 untuk money", () => {
    const dummyStory: StoryDetail = {
      id: "TEST-01",
      epic: "EPIC-TEST",
      title: "Bank Account Balance Service",
      description: "Manage user account balance with strict financial precision",
      tea_tier: "P0",
      priority: "P0",
      depends_on: [],
      target_files: ["lib/app/accounts/account.ex", "priv/repo/migrations/create_accounts.exs"],
      ac: [],
    };

    const schema = inferDataSchema(dummyStory, REPO_ROOT);
    expect(schema.hasSchema).toBeTrue();
    expect(schema.framework).toBe("ecto");
    const balanceField = schema.fields?.find((f) => f.name === "balance");
    expect(balanceField?.type).toBe(":decimal");
    expect(balanceField?.constraints).toContain("Hukum Besi #1");
  });

  it("generateGherkin: menghasilkan format Gherkin valid dengan tag @tea-01", async () => {
    const { story } = await loadStoryDetail("D-01", REPO_ROOT);
    const gherkin = generateGherkin(story);

    expect(gherkin).toContain("Feature: D-01 - Story JIT Spec Generator (/ompimpa:story)");
    expect(gherkin).toContain("@ac-d01-1 @tea-01");
    expect(gherkin).toContain("Scenario: AC-D01-1 - ompimpa story <ID> dijalankan");
    expect(gherkin).toContain("Given story ID valid di stories.yaml");
    expect(gherkin).toContain("When ompimpa story <ID> dijalankan");
    expect(gherkin).toContain("Then file _ompimpa/specs/SPEC-[ID].md terbit dengan Gherkin dan signature fungsi");
  });

  it("partitionTargetFiles: memisahkan target implementasi dan target uji ATDD", async () => {
    const { story } = await loadStoryDetail("D-01", REPO_ROOT);
    const { targetFiles, testFiles } = partitionTargetFiles(story);

    expect(targetFiles).toContain("commands/story.md");
    expect(targetFiles).toContain("src/story_spec.ts");
    expect(testFiles).toContain("test/story_spec.test.ts");
  });

  it("getBlastRadiusForStory: mengidentifikasi modul tooling sebagai leaf_isolated", async () => {
    const { story } = await loadStoryDetail("D-01", REPO_ROOT);
    const blast = await getBlastRadiusForStory(story, REPO_ROOT);

    expect(blast.coreContextTouched).toBeFalse();
    expect(blast.method).toBe("leaf_isolated");
    expect(blast.affectedCallers.length).toBe(0);
  });

  it("AC-D01-1: ketika generator dijalankan, berkas _ompimpa/specs/SPEC-[ID].md terbit deterministik", async () => {
    const result = await generateStorySpec("D-01", {
      repoRoot: REPO_ROOT,
      date: "2026-09-03",
    });

    expect(result.storyId).toBe("D-01");
    expect(result.epicId).toBe("EPIC-D");
    expect(result.specFilePath).toContain("_ompimpa/specs/SPEC-D-01.md");

    // Verifikasi berkas fisik ada di disk
    const fileExistsOnDisk = await fs.access(result.specFilePath).then(() => true).catch(() => false);
    expect(fileExistsOnDisk).toBeTrue();

    const diskContent = await fs.readFile(result.specFilePath, "utf-8");
    expect(diskContent).toBe(result.content);

    // 1. Skenario Gherkin presisi (TEA-01)
    expect(diskContent).toContain("```gherkin");
    expect(diskContent).toContain("Feature: D-01");
    expect(diskContent).toContain("Scenario: AC-D01-1");
    expect(diskContent).toContain("Given story ID valid di stories.yaml");
    expect(diskContent).toContain("When ompimpa story <ID> dijalankan");
    expect(diskContent).toContain("Then file _ompimpa/specs/SPEC-[ID].md terbit dengan Gherkin dan signature fungsi");

    // 2. Tanda tangan fungsi (exact signatures, typespecs, & arity)
    expect(diskContent).toContain("generateStorySpec/2");
    expect(diskContent).toContain("loadStoryDetail/2");
    expect(diskContent).toContain("getBlastRadiusForStory/2");
    expect(diskContent).toContain("generateStorySpec(storyId: string, options?: StorySpecOptions): Promise<StorySpecResult>");

    // 3. Skema data / Ecto / Ash resource
    expect(diskContent).toContain("Skema Data & Konfigurasi Ecto / Ash Resource");

    // 4. Daftar berkas target implementasi dan berkas tes
    expect(diskContent).toContain("commands/story.md");
    expect(diskContent).toContain("src/story_spec.ts");
    expect(diskContent).toContain("test/story_spec.test.ts");

    // 5. Blast-radius lazy mix xref
    expect(diskContent).toContain("Analisis Dampak & Blast-Radius (*Lazy mix xref*)");
    expect(diskContent).toContain("leaf_isolated");

    // 6. Tata kelola & Quality Gates
    expect(diskContent).toContain("PRD-002");
    expect(diskContent).toContain("ADR-002");
    expect(diskContent).toContain("TEA-01 Traceability");
    expect(diskContent).toContain("100/100 PASS");
  });

  it("generateStorySpec: bersifat deterministik (dua pemanggilan menghasilkan konten identik)", async () => {
    const res1 = await generateStorySpec("D-01", {
      repoRoot: REPO_ROOT,
      dryRun: true,
      date: "2026-09-03",
    });

    const res2 = await generateStorySpec("D-01", {
      repoRoot: REPO_ROOT,
      dryRun: true,
      date: "2026-09-03",
    });

    expect(res1.content).toBe(res2.content);
    expect(res1.specFilePath).toBe(res2.specFilePath);
  });

  it("CLI: ompimpa story D-01 berhasil dieksekusi via CLI subprocess", async () => {
    const res = await runCli(["story", "D-01"]);
    expect(res.code).toBe(0);

    const output = res.stdout + res.stderr;
    expect(output).toContain("JIT Story Spec Generator (/ompimpa:story)");
    expect(output).toContain("Story: D-01 (EPIC-D)");
    expect(output).toContain("SPEC-D-01.md");
    expect(output).toContain("TEA-01 ready");
    expect(output).toContain("/atdd D-01");
  });

  it("CLI: ompimpa story D-01 --dry-run menampilkan pratinjau tanpa error", async () => {
    const res = await runCli(["story", "D-01", "--dry-run"]);
    expect(res.code).toBe(0);

    const output = res.stdout + res.stderr;
    expect(output).toContain("[DRY-RUN] Pratinjau spesifikasi untuk D-01");
    expect(output).toContain("Feature: D-01");
    expect(output).toContain("Scenario: AC-D01-1");
  });

  it("CLI: ompimpa story tanpa argumen gagal dengan kode 1", async () => {
    const res = await runCli(["story"]);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("Story ID is required");
  });

  it("CLI: ompimpa story dengan ID tidak valid gagal dengan kode 1", async () => {
    const res = await runCli(["story", "INVALID-999"]);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("INVALID-999");
    expect(res.stderr).toContain("not found");
  });

  it("generateStorySpec: SPEC adalah story file tunggal ala upstream (frontmatter + frozen + logs)", async () => {
    const res = await generateStorySpec("D-01", { repoRoot: REPO_ROOT, dryRun: true, date: "2026-09-03" });
    // Frontmatter lifecycle
    expect(res.content).toContain("status: 'ready-for-atdd'");
    expect(res.content).toContain("review_loop_iteration: 0");
    // Frozen intent milik manusia
    expect(res.content).toContain("<frozen-after-approval");
    expect(res.content).toContain("## Intent");
    expect(res.content).toContain("## Boundaries & Constraints");
    // Gerbang open questions
    expect(res.content).toContain("## 0. Open Questions");
    // Code map + tasks per berkas + verification
    expect(res.content).toContain("## 6c. Code Map");
    expect(res.content).toContain("## 6b. Tasks & Acceptance");
    expect(res.content).toContain("- [ ] `src/story_spec.ts`");
    expect(res.content).toContain("## 8. Verification");
    expect(res.content).toContain("bun test test/story_spec.test.ts");
    // Log append-only
    expect(res.content).toContain("## 9. Implementation Notes");
    expect(res.content).toContain("## 10. Spec Change Log");
    expect(res.content).toContain("## 11. Review Triage Log");
  });
});
