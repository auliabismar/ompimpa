import * as fs from "node:fs/promises";
import * as path from "node:path";
import yaml from "yaml";

export type InspeksiPilar = "batas" | "performa" | "keamanan" | "docs";

export interface PilarScores {
  batas: number;
  performa: number;
  keamanan: number;
  docs: number;
  overall: number;
}

export interface InspeksiFinding {
  id?: string;
  pillar: InspeksiPilar;
  severity: "P0" | "P1" | "P2" | "P3";
  title: string;
  description: string;
  ruleId?: string;
  target_files?: string[];
  tea_tier?: "P0" | "P1" | "P2";
  remediation?: string;
  file?: string;
  line?: number;
}

export interface InspeksiOptions {
  repoRoot?: string;
  targetDir?: string;
  autoTriageDebt?: boolean; // default true: otomatis generate EPIC-DEBT
  dryRun?: boolean;
  filterPillar?: InspeksiPilar;
}

export interface InspeksiResult {
  scores: PilarScores;
  reportPath: string;
  details: Record<string, unknown>;
  findings: InspeksiFinding[];
  generatedStories: Array<{ id: string; title: string; epic: string }>;
  deferredEntries: InspeksiFinding[];
}

/**
 * Utilitas penulisan berkas atomik (write-and-rename) untuk mencegah korupsi atau pemotongan berkas (TEA-23).
 */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}

/**
 * C-06 & E-03: Master Diagnostic Out-of-Band (/ompimpa:inspect)
 * Menyatukan 4 pilar arsitektural (Batas, Performa, Keamanan, Docs)
 * dan mengotomatiskan pembuatan backlog perbaikan EPIC-DEBT pada stories.yaml (INV-11).
 */
export async function runInspeksi(
  targetDir: string = process.cwd(),
  options: InspeksiOptions = {}
): Promise<InspeksiResult> {
  const scores: PilarScores = { batas: 100, performa: 100, keamanan: 100, docs: 100, overall: 100 };
  const details: Record<string, unknown> = {};
  const findings: InspeksiFinding[] = [];

  const autoTriageDebt = options.autoTriageDebt ?? true;
  const dryRun = options.dryRun ?? false;
  const filterPillar = options.filterPillar;

  // --- 1. Pilar Batas (Boundary & Circular) — TEA-15, TEA-16 ---
  if (!filterPillar || filterPillar === "batas") {
    await auditBatas(targetDir, scores, details, findings);
  }

  // --- 2. Pilar Performa (NFR latency T1<2s/T2<10s) — TEA-26 ---
  if (!filterPillar || filterPillar === "performa") {
    await auditPerforma(targetDir, scores, details, findings);
  }

  // --- 3. Pilar Keamanan (Security & OWASP, sobelow, 26 laws) — TEA-08 ---
  if (!filterPillar || filterPillar === "keamanan") {
    await auditKeamanan(targetDir, scores, details, findings);
  }

  // --- 4. Pilar Docs (Diátaxis 4 quadrants) — TEA-35 ---
  if (!filterPillar || filterPillar === "docs") {
    await auditDocs(targetDir, scores, details, findings);
  }

  // Overall average
  if (filterPillar) {
    scores.overall = scores[filterPillar];
  } else {
    scores.overall = Math.round((scores.batas + scores.performa + scores.keamanan + scores.docs) / 4);
  }
  for (const k of ["batas", "performa", "keamanan", "docs", "overall"] as const) {
    scores[k] = Math.max(0, Math.min(100, Math.round(scores[k])));
  }

  // --- Auto-Triage & EPIC-DEBT Story Generation (AC-E03-1) ---
  let generatedStories: Array<{ id: string; title: string; epic: string }> = [];
  let deferredEntries: InspeksiFinding[] = [];

  if (autoTriageDebt && !dryRun) {
    const debtRes = await generateDebtStories(findings, targetDir);
    generatedStories = debtRes.createdStories;
    deferredEntries = debtRes.deferredEntries;
  }

  // Write report.md
  const inspeksiDir = path.join(targetDir, "_ompimpa", "inspeksi");
  await fs.mkdir(inspeksiDir, { recursive: true });
  const reportPath = path.join(inspeksiDir, "report.md");
  const now = new Date().toISOString();

  const report = `# Inspeksi 4-Pilar Scorecard 0–100

> **Generated:** ${now} — via \`src/inspeksi.ts\` (Master Diagnostic Out-of-Band)
> **Toolchain:** graphify (xref+fallback) + credo + sobelow + Diátaxis validate + EPIC-DEBT Auto-Triage
${filterPillar ? `> **Filter:** Pilar \`${filterPillar}\` saja\n` : ""}
## Ringkasan Skor

| Pilar | Skor | Status | Bobot |
|---|---|---|---|
| **Batas** (Boundary & Circular — TEA-15/16) | **${scores.batas}/100** | ${scores.batas >= 80 ? "✅ Sehat" : scores.batas >= 60 ? "⚠️ Waspada" : "❌ Kritis"} | Boundary, DAG, xref blast-radius |
| **Performa** (Latency T1<2s/T2<10s — TEA-26) | **${scores.performa}/100** | ${scores.performa >= 80 ? "✅ Sehat" : scores.performa >= 60 ? "⚠️ Waspada" : "❌ Kritis"} | Tiered verify, graphify <2s |
| **Keamanan** (Security & Iron Laws — TEA-08) | **${scores.keamanan}/100** | ${scores.keamanan >= 80 ? "✅ Sehat" : scores.keamanan >= 60 ? "⚠️ Waspada" : "❌ Kritis"} | 26 Laws, pitfalls, sobelow, credo |
| **Docs** (Diátaxis 4 Kuadran — TEA-35) | **${scores.docs}/100** | ${scores.docs >= 80 ? "✅ Sehat" : scores.docs >= 60 ? "⚠️ Waspada" : "❌ Kritis"} | Tutorials/How-To/Reference/Explanation |
| **Overall** | **${scores.overall}/100** | ${scores.overall >= 80 ? "✅ LULUS" : scores.overall >= 60 ? "⚠️ PERLU PERBAIKAN" : "❌ GAGAL"} | Rata-rata 4 pilar |

## Detail Per Pilar

### 1. Batas — Boundary & Circular
- **Graph:** ${JSON.stringify(details.graph || "missing")}
- **Isu:** ${(details as any).batas_issue || "none"}
- **Scoring:** 100 -30 jika cycle, -10 per boundary violation, -20 jika stories.yaml hilang atau circular.

### 2. Performa — Latency & Tiered
- **Tiered:** ${JSON.stringify(details.performa_tiered || "missing")}
- **Graph elapsed:** ${(details as any).performa_graph_elapsed || "n/a"}ms (target <2000ms)
- **N+1 / Assigns:** ${(details as any).performa_n1_count ? `${(details as any).performa_n1_count} potensi isu` : "bersih"}
- **Isu:** ${(details as any).performa_issue || "none"}

### 3. Keamanan — Iron Laws & Linters
- **Pitfalls:** ${(details as any).keamanan_pitfalls ? "exists" : "missing"} (rules/pitfalls.md)
- **26 Laws:** ${(details as any).keamanan_ruleCount || 0}/26 files
- **Linters:** ${JSON.stringify((details as any).keamanan_linters || {})} (credo+sobelow di tier3)

### 4. Docs — Diátaxis 4 Kuadran
- **Quadrants:** ${JSON.stringify((details as any).docs_quadrants || {})}
- **Missing:** ${(details as any).docs_missing || 0} quadrants kosong
- **Placeholders:** ${(details as any).docs_hasPlaceholder ? "ada TODO/placeholder" : "none"}

## Closed-Loop Debt Triage (AC-E03-1)
- **Story Baru di-generate (EPIC-DEBT):** ${generatedStories.length} stories
${generatedStories.map((s) => `  • [${s.id}] ${s.title}`).join("\n") || "  • (tidak ada temuan kritis P0/P1)"}
- **Temuan Non-Kritis Ditangguhkan (deferred.md):** ${deferredEntries.length} entri

## Rekomendasi
${scores.batas < 80 ? "- Perbaiki circular dependency via graphify blast-radius sebelum merge.\n" : ""}${scores.performa < 80 ? "- Pastikan T1<2s, T2<10s, graphify <2s (fallback LSP lazy).\n" : ""}${scores.keamanan < 80 ? "- Lengkapi 26 Laws, jalankan sobelow --strict, update pitfalls.md.\n" : ""}${scores.docs < 80 ? "- Jalankan `ompimpa doc` untuk generate 4 kuadran tanpa placeholder.\n" : ""}${scores.overall >= 80 ? "- ✅ Semua pilar sehat — siap untuk review macro dan merge.\n" : ""}

## Artefak
- Graph: \`_ompimpa/graph.json\` + \`_ompimpa/graph.html\`
- Stories DAG: \`_ompimpa/stories.yaml\`
- Deferred Debt: \`_ompimpa/deferred.md\`
- Docs: \`docs/{tutorials,how-to,reference,explanation}/*.md\`
- Registry: \`_ompimpa/criteria_registry_35.json\` (35-Row v2)

---
*Master Diagnostic Out-of-Band (/ompimpa:inspect). Scoring deterministik & Invariant INV-11 compliant.*
`;

  await atomicWriteFile(reportPath, report);

  return {
    scores,
    reportPath,
    details,
    findings,
    generatedStories,
    deferredEntries,
  };
}

/**
 * 1. Evaluator Pilar Batas (Boundaries & Circular Dependencies)
 */
async function auditBatas(
  targetDir: string,
  scores: PilarScores,
  details: Record<string, unknown>,
  findings: InspeksiFinding[]
): Promise<void> {
  // A. Evaluasi Graph Boundary & Circular Dependencies
  const graphPath = path.join(targetDir, "_ompimpa", "graph.json");
  try {
    const graphRaw = await fs.readFile(graphPath, "utf-8");
    let graph: any = null;
    try {
      graph = JSON.parse(graphRaw);
    } catch (parseErr) {
      scores.batas = Math.max(0, scores.batas - 20);
      details.batas_issue = "graph.json corrupt syntax error";
      findings.push({
        pillar: "batas",
        severity: "P1",
        title: "Corrupt Dependency Graph JSON Syntax",
        description: `Berkas _ompimpa/graph.json tidak dapat diparsing: ${String(parseErr)}`,
        ruleId: "TEA-15",
        tea_tier: "P1",
        remediation: "Jalankan ulang ompimpa graphify untuk regenerasi graph.json yang valid.",
        target_files: ["_ompimpa/graph.json"],
      });
    }

    if (graph && typeof graph === "object") {
      const hasCycle = Boolean(graph.circular_check?.hasCycle);
      const edges = Array.isArray(graph.edges) ? graph.edges.length : 0;
      const nodes = Array.isArray(graph.nodes) ? graph.nodes.length : 0;
      details.graph = { nodes, edges, hasCycle };

      if (hasCycle) {
        scores.batas = Math.max(0, scores.batas - 30);
        const cycleList = Array.isArray(graph.circular_check?.cycle) ? graph.circular_check.cycle : [];
        const cyclePath = cycleList.length > 0 ? cycleList.join(" → ") : "detected cycle";
        details.batas_issue = `Circular dependency detected: ${cyclePath}`;

        findings.push({
          pillar: "batas",
          severity: "P0",
          title: "Circular Dependency Detected across Module Boundaries",
          description: `Circular dependency detected: ${cyclePath}`,
          ruleId: "TEA-15",
          tea_tier: "P0",
          remediation: "Break cycle using dependency inversion, event bus, or message passing.",
          target_files: cycleList.length > 0 ? cycleList : ["_ompimpa/graph.json"],
        });
      }

      // Boundary violations from graph
      const violations = Array.isArray(graph.boundary_violations) ? graph.boundary_violations : [];
      if (violations.length > 0) {
        scores.batas = Math.max(0, scores.batas - violations.length * 10);
        for (const v of violations) {
          if (v && typeof v === "object") {
            findings.push({
              pillar: "batas",
              severity: "P1",
              title: `Boundary Violation: ${v.from} -> ${v.to}`,
              description: v.reason || "Cross-context boundary violation without public contract facade",
              ruleId: "TEA-16",
              tea_tier: "P1",
              remediation: "Enforce domain boundary through explicit context API facade.",
              target_files: [v.from, v.to].filter(Boolean),
            });
          }
        }
      }
    }
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      scores.batas = Math.max(0, scores.batas - 30);
      details.batas_issue = "graph.json missing — run ompimpa graphify";
      findings.push({
        pillar: "batas",
        severity: "P2",
        title: "Dependency Graph Missing (_ompimpa/graph.json)",
        description: "Berkas graph.json belum dibuat. Jalankan ompimpa graphify untuk analisis blast-radius.",
        ruleId: "TEA-15",
        tea_tier: "P2",
        remediation: "Eksekusi ompimpa graphify untuk memetakan coupling modul.",
      });
    } else {
      scores.batas = Math.max(0, scores.batas - 20);
      details.batas_issue = `graph.json read error: ${err?.message}`;
    }
  }

  // B. Evaluasi Stories DAG Topologi & Siklus Dependensi
  const storiesPath = path.join(targetDir, "_ompimpa", "stories.yaml");
  try {
    const storiesRaw = await fs.readFile(storiesPath, "utf-8");
    let parsedStories: any = null;
    try {
      parsedStories = yaml.parse(storiesRaw);
    } catch (yamlErr) {
      scores.batas = Math.max(0, scores.batas - 20);
      findings.push({
        pillar: "batas",
        severity: "P1",
        title: "Malformed stories.yaml Structure",
        description: `Gagal mem-parsing _ompimpa/stories.yaml: ${String(yamlErr)}`,
        ruleId: "TEA-15",
        tea_tier: "P1",
        remediation: "Perbaiki sintaks YAML pada _ompimpa/stories.yaml.",
        target_files: ["_ompimpa/stories.yaml"],
      });
    }

    if (!parsedStories || !Array.isArray(parsedStories.stories)) {
      scores.batas = Math.max(0, scores.batas - 20);
      details.batas_issue = (details.batas_issue ? details.batas_issue + "; " : "") + "stories.yaml missing stories array";
      findings.push({
        pillar: "batas",
        severity: "P1",
        title: "Missing stories.yaml Architecture DAG",
        description: "Berkas _ompimpa/stories.yaml tidak ditemukan atau tidak memuat array stories yang valid.",
        ruleId: "TEA-15",
        tea_tier: "P1",
        remediation: "Inisialisasi stories.yaml melalui ompimpa init atau buat skema DAG yang valid.",
        target_files: ["_ompimpa/stories.yaml"],
      });
    } else {
      // Deteksi Siklus Topologis (Circular DAG) pada stories.yaml
      const storyGraph = new Map<string, string[]>();
      for (const s of parsedStories.stories) {
        if (s && s.id) {
          const deps = Array.isArray(s.depends_on) ? s.depends_on.filter(Boolean) : [];
          storyGraph.set(s.id, deps);
        }
      }

      const visited = new Set<string>();
      const recStack = new Set<string>();
      let cycleFound: string[] | null = null;

      function detectCycle(node: string, currentPath: string[]): boolean {
        visited.add(node);
        recStack.add(node);
        const neighbors = storyGraph.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (detectCycle(neighbor, [...currentPath, neighbor])) return true;
          } else if (recStack.has(neighbor)) {
            cycleFound = [...currentPath, neighbor];
            return true;
          }
        }
        recStack.delete(node);
        return false;
      }

      for (const storyId of storyGraph.keys()) {
        if (!visited.has(storyId)) {
          if (detectCycle(storyId, [storyId])) break;
        }
      }

      if (cycleFound) {
        scores.batas = Math.max(0, scores.batas - 30);
        const cycleStr = (cycleFound as string[]).join(" → ");
        details.batas_issue = (details.batas_issue ? details.batas_issue + "; " : "") + `Circular stories DAG: ${cycleStr}`;
        findings.push({
          pillar: "batas",
          severity: "P0",
          title: "Circular Dependency Detected in stories.yaml DAG",
          description: `Terdeteksi ketergantungan melingkar pada stories.yaml: ${cycleStr}`,
          ruleId: "TEA-16",
          tea_tier: "P0",
          remediation: "Putus siklus ketergantungan pada depends_on di _ompimpa/stories.yaml.",
          target_files: ["_ompimpa/stories.yaml"],
        });
      }
    }
  } catch (err: any) {
    scores.batas = Math.max(0, scores.batas - 20);
    details.batas_issue = (details.batas_issue ? details.batas_issue + "; " : "") + "stories.yaml missing";
    findings.push({
      pillar: "batas",
      severity: "P1",
      title: "Missing stories.yaml Architecture DAG",
      description: "Berkas _ompimpa/stories.yaml tidak dapat diakses.",
      ruleId: "TEA-15",
      tea_tier: "P1",
      remediation: "Buat berkas _ompimpa/stories.yaml dengan daftar stories yang valid.",
      target_files: ["_ompimpa/stories.yaml"],
    });
  }
}

/**
 * 2. Evaluator Pilar Performa (NFR Latency & Verification)
 */
async function auditPerforma(
  targetDir: string,
  scores: PilarScores,
  details: Record<string, unknown>,
  findings: InspeksiFinding[]
): Promise<void> {
  // A. Verifikasi Konfigurasi Tiered T1/T2/T3
  try {
    const tomlPath = path.join(targetDir, "ompimpa.toml");
    const toml = await fs.readFile(tomlPath, "utf-8").catch(() => "");
    const hasTier1 = toml.includes("[quality.verify.tier1]");
    const hasTier2 = toml.includes("[quality.verify.tier2]");
    const hasTier3 = toml.includes("[quality.verify.tier3]");
    details.performa_tiered = { hasTier1, hasTier2, hasTier3 };

    if (!hasTier1 || !hasTier2) {
      scores.performa = Math.max(0, scores.performa - 20);
      details.performa_issue = "tiered T1/T2 not configured";
      findings.push({
        pillar: "performa",
        severity: "P1",
        title: "Tiered Verification T1/T2 Not Configured",
        description: "ompimpa.toml belum mengonfigurasi [quality.verify.tier1] atau [quality.verify.tier2].",
        ruleId: "TEA-26",
        tea_tier: "P1",
        remediation: "Tambahkan konfigurasi tier1 (<2s) dan tier2 (<10s) pada ompimpa.toml.",
        target_files: ["ompimpa.toml"],
      });
    }

    // B. Periksa Graphify Latency < 2000ms
    try {
      const graphRaw = await fs.readFile(path.join(targetDir, "_ompimpa", "graph.json"), "utf-8");
      const graph = JSON.parse(graphRaw);
      const elapsed = graph.stats?.elapsed_ms || 0;
      details.performa_graph_elapsed = elapsed;
      if (elapsed > 2000) {
        scores.performa = Math.max(0, scores.performa - 15);
        details.performa_issue = `graphify >2s (${elapsed}ms) — fallback LSM lazy not used`;
        findings.push({
          pillar: "performa",
          severity: "P1",
          title: "Graphify Latency Exceeds NFR Threshold (>2000ms)",
          description: `graphify >2s (${elapsed}ms) — fallback LSM lazy not used`,
          ruleId: "TEA-26",
          tea_tier: "P1",
          remediation: "Optimasi pembuatan dependency graph atau gunakan evaluasi lazy caching.",
          target_files: ["_ompimpa/graph.json"],
        });
      }
    } catch {}

    // C. Heuristik Pemindaian N+1 Kueri & LiveView Assigns Memory
    const libDir = path.join(targetDir, "lib");
    let n1Count = 0;
    try {
      async function scanCode(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await scanCode(full);
          } else if (entry.isFile() && (entry.name.endsWith(".ex") || entry.name.endsWith(".heex"))) {
            const content = await fs.readFile(full, "utf-8");
            // Deteksi Repo.call di dalam loop Enum
            if (/Enum\.(?:map|each)\s*\([\s\S]*?Repo\.(?:all|get|one)/.test(content)) {
              n1Count++;
              findings.push({
                pillar: "performa",
                severity: "P1",
                title: `Potential N+1 Query in ${entry.name}`,
                description: `Terdeteksi pemanggilan Repo di dalam iterasi Enum pada ${entry.name}.`,
                ruleId: "TEA-26",
                tea_tier: "P1",
                remediation: "Gunakan preload pada kueri utama atau batching Repo queries.",
                target_files: [path.relative(targetDir, full)],
              });
            }
          }
        }
      }
      await scanCode(libDir);
      details.performa_n1_count = n1Count;
      if (n1Count > 0) {
        scores.performa = Math.max(0, scores.performa - n1Count * 10);
      }
    } catch {}
  } catch {
    scores.performa = 80;
  }
}

/**
 * 3. Evaluator Pilar Keamanan (Security, OWASP, 26 Laws)
 */
async function auditKeamanan(
  targetDir: string,
  scores: PilarScores,
  details: Record<string, unknown>,
  findings: InspeksiFinding[]
): Promise<void> {
  try {
    const pitfallsPath = path.join(targetDir, "rules", "pitfalls.md");
    const pitfallsExists = await fs.stat(pitfallsPath).then(() => true).catch(() => false);
    details.keamanan_pitfalls = pitfallsExists;
    if (!pitfallsExists) {
      scores.keamanan = Math.max(0, scores.keamanan - 10);
      findings.push({
        pillar: "keamanan",
        severity: "P2",
        title: "Pitfalls Catalog Missing (rules/pitfalls.md)",
        description: "Katalog pitfalls rules/pitfalls.md belum ditemukan.",
        ruleId: "TEA-08",
        remediation: "Scaffold rules/pitfalls.md untuk mencatat pelajaran keamanan dan anti-patterns.",
      });
    }

    // Check for 26 laws files
    const rulesDir = path.join(targetDir, "rules");
    let ruleCount = 0;
    try {
      const files = await fs.readdir(rulesDir);
      ruleCount = files.filter((f) => /^\d{2}-/.test(f)).length;
    } catch {}
    details.keamanan_ruleCount = ruleCount;
    if (ruleCount < 26) {
      scores.keamanan = Math.max(0, scores.keamanan - 15);
      findings.push({
        pillar: "keamanan",
        severity: "P1",
        title: `Incomplete Iron Laws Files (${ruleCount}/26)`,
        description: `Hanya ditemukan ${ruleCount}/26 berkas aturan Hukum Besi di rules/.`,
        ruleId: "TEA-08",
        tea_tier: "P1",
        remediation: "Lengkapi 26 berkas 1:1 Hukum Besi Elixir pada rules/01..26.",
      });
    }

    // Sobelow/credo presence check via ompimpa.toml tier3
    const toml = await fs.readFile(path.join(targetDir, "ompimpa.toml"), "utf-8").catch(() => "");
    const hasSobelow = toml.includes("sobelow");
    const hasCredo = toml.includes("credo");
    details.keamanan_linters = { hasSobelow, hasCredo };
    if (!hasSobelow || !hasCredo) {
      scores.keamanan = Math.max(0, scores.keamanan - 5);
      findings.push({
        pillar: "keamanan",
        severity: "P2",
        title: "Linters Sobelow / Credo Not Configured in Tier 3",
        description: "ompimpa.toml belum menyertakan sobelow atau credo pada quality verify tier 3.",
        ruleId: "TEA-08",
        remediation: "Tambahkan linter statis keamanan ke dalam tier3 verification.",
      });
    }
  } catch {
    scores.keamanan = 85;
  }
}

/**
 * 4. Evaluator Pilar Docs & Techdebt (Diátaxis Completeness)
 */
async function auditDocs(
  targetDir: string,
  scores: PilarScores,
  details: Record<string, unknown>,
  findings: InspeksiFinding[]
): Promise<void> {
  try {
    const docsDir = path.join(targetDir, "docs");
    const quadrants = ["tutorials", "how-to", "reference", "explanation"] as const;
    const counts: Record<string, number> = {};
    let missingQuadrants = 0;

    for (const q of quadrants) {
      try {
        const files = await fs.readdir(path.join(docsDir, q));
        const mdCount = files.filter((f) => f.endsWith(".md")).length;
        counts[q] = mdCount;
        if (mdCount === 0) {
          scores.docs = Math.max(0, scores.docs - 25);
          missingQuadrants++;
          findings.push({
            pillar: "docs",
            severity: "P2",
            title: `Diátaxis Quadrant Empty: docs/${q}/`,
            description: `Kuadran dokumentasi docs/${q}/ tidak memuat berkas markdown.`,
            ruleId: "TEA-35",
            remediation: `Buat dokumentasi kuadran ${q} atau jalankan ompimpa doc.`,
          });
        }
      } catch {
        counts[q] = 0;
        scores.docs = Math.max(0, scores.docs - 25);
        missingQuadrants++;
        findings.push({
          pillar: "docs",
          severity: "P2",
          title: `Diátaxis Quadrant Missing: docs/${q}/`,
          description: `Folder kuadran docs/${q}/ tidak ditemukan.`,
          ruleId: "TEA-35",
          remediation: `Buat struktur folder docs/${q}/ sesuai Diátaxis.`,
        });
      }
    }
    details.docs_quadrants = counts;
    details.docs_missing = missingQuadrants;

    // Check for placeholder
    let hasPlaceholder = false;
    for (const q of quadrants) {
      try {
        const dir = path.join(docsDir, q);
        const files = await fs.readdir(dir);
        for (const f of files.filter((x) => x.endsWith(".md"))) {
          const c = await fs.readFile(path.join(dir, f), "utf-8");
          if (c.toLowerCase().includes("placeholder") || c.toLowerCase().includes("todo:")) {
            hasPlaceholder = true;
          }
        }
      } catch {}
    }
    details.docs_hasPlaceholder = hasPlaceholder;
    if (hasPlaceholder) {
      scores.docs = Math.max(0, scores.docs - 15);
      findings.push({
        pillar: "docs",
        severity: "P2",
        title: "Documentation Placeholders or TODOs Detected",
        description: "Ditemukan berkas dokumentasi yang memuat kata 'placeholder' atau 'TODO:'.",
        ruleId: "TEA-35",
        remediation: "Lengkapi konten dokumentasi dan hilangkan placeholder.",
      });
    }
  } catch {
    scores.docs = 60;
  }
}

/**
 * Menerbitkan temuan P0/P1 menjadi user stories di bawah EPIC-DEBT pada stories.yaml,
 * serta mencatat temuan P2/P3 ke deferred.md tanpa mengubah feature-status.yaml (INV-11).
 */
export async function generateDebtStories(
  findings: InspeksiFinding[],
  targetDir: string = process.cwd()
): Promise<{
  createdStories: Array<{ id: string; title: string; epic: string }>;
  deferredEntries: InspeksiFinding[];
}> {
  const createdStories: Array<{ id: string; title: string; epic: string }> = [];
  const deferredEntries: InspeksiFinding[] = [];

  const debtFindings = findings.filter((f) => f.severity === "P0" || f.severity === "P1");
  const nonCriticalFindings = findings.filter((f) => f.severity === "P2" || f.severity === "P3");

  // 1. Triage P0/P1 -> Update _ompimpa/stories.yaml via AST Comments Preservation & Atomic Write
  if (debtFindings.length > 0) {
    const storiesPath = path.join(targetDir, "_ompimpa", "stories.yaml");
    try {
      const raw = await fs.readFile(storiesPath, "utf-8");
      const doc = yaml.parseDocument(raw);

      let epics = doc.get("epics") as any;
      if (!epics || typeof epics !== "object") {
        doc.set("epics", []);
        epics = doc.get("epics") as any;
      }

      // Pastikan EPIC-DEBT terdaftar
      const epicsJson: any[] = epics.toJSON ? epics.toJSON() : [];
      let hasEpicDebt = epicsJson.some((e: any) => e && e.id === "EPIC-DEBT");
      if (!hasEpicDebt) {
        const epicDebtObj = {
          id: "EPIC-DEBT",
          title: "Hutang Teknis Arsitektural & Performa",
          description: "Backlog perbaikan hutang teknis otomatis yang dihasilkan oleh master diagnostic out-of-band /ompimpa:inspect.",
        };
        epics.add(doc.createNode(epicDebtObj));
      }

      let stories = doc.get("stories") as any;
      if (!stories || typeof stories !== "object") {
        doc.set("stories", []);
        stories = doc.get("stories") as any;
      }

      const storiesJson: any[] = stories.toJSON ? stories.toJSON() : [];

      // Circuit Breaker: Batasi maksimal 10 story DEBT aktif per pilar
      const pendingByPillar: Record<string, number> = {};
      for (const s of storiesJson) {
        if (s && typeof s.id === "string" && s.id.startsWith("DEBT-")) {
          const p = s.id.startsWith("DEBT-BND") ? "batas" : s.id.startsWith("DEBT-PRF") ? "performa" : "gen";
          pendingByPillar[p] = (pendingByPillar[p] || 0) + 1;
        }
      }

      const storiesToPush: any[] = [];

      for (const finding of debtFindings) {
        const pillarKey = finding.pillar === "batas" ? "batas" : finding.pillar === "performa" ? "performa" : "gen";
        if ((pendingByPillar[pillarKey] || 0) >= 10) {
          // Circuit breaker triggered for this pillar
          continue;
        }

        // Deduplikasi identitas deterministik (pillar + ruleId + target_files / title)
        const isDuplicate = storiesJson.some(
          (s: any) =>
            s &&
            (s.title === `[DEBT] ${finding.title}` ||
             (s.description && s.description.includes(finding.description.slice(0, 35))))
        );
        if (isDuplicate) continue;

        let prefix = "DEBT-GEN";
        if (finding.pillar === "batas") prefix = "DEBT-BND";
        else if (finding.pillar === "performa") prefix = "DEBT-PRF";

        // Hitung ID maksimal berbasis numerik terpisah per prefix (MAX(id) + 1)
        const matchingIds = storiesJson
          .map((s: any) => s && typeof s.id === "string" ? s.id : "")
          .filter((id: string) => id.startsWith(`${prefix}-`));

        let maxNum = 0;
        for (const mid of matchingIds) {
          const parts = mid.split("-");
          const n = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }

        // Pertimbangkan juga story yang siap di-push
        for (const queued of storiesToPush) {
          if (queued.id.startsWith(`${prefix}-`)) {
            const parts = queued.id.split("-");
            const n = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          }
        }

        const nextNum = maxNum + 1;
        const storyId = `${prefix}-${String(nextNum).padStart(2, "0")}`;

        const newStory = {
          id: storyId,
          epic: "EPIC-DEBT",
          title: `[DEBT] ${finding.title}`,
          description: finding.description,
          tea_tier: finding.tea_tier || (finding.severity === "P0" ? "P0" : "P1"),
          priority: finding.severity === "P0" ? "P0" : "P1",
          depends_on: [] as string[],
          target_files: finding.target_files || [],
          ac: [
            {
              id: `AC-${storyId.replace(/-/g, "")}-1`,
              given: `codebase dipindai dengan /inspect dan terdeteksi ${finding.pillar} (${finding.severity}): ${finding.title}`,
              when: `perbaikan diimplementasikan dan diverifikasi via scoped test`,
              then: `skor pilar ${finding.pillar} meningkat dan temuan ${finding.ruleId || "terselesaikan"}`,
            },
          ],
          kill_criteria: [] as string[],
          estimate: "S",
          scoring_impact: finding.ruleId || "TEA-15, TEA-26",
        };

        storiesToPush.push(newStory);
        pendingByPillar[pillarKey] = (pendingByPillar[pillarKey] || 0) + 1;
      }

      if (storiesToPush.length > 0) {
        for (const st of storiesToPush) {
          stories.add(doc.createNode(st));
        }
        await atomicWriteFile(storiesPath, doc.toString());
        // Hanya tambahkan ke createdStories setelah penulisan berkas terverifikasi sukses
        for (const st of storiesToPush) {
          createdStories.push({
            id: st.id,
            title: st.title,
            epic: st.epic,
          });
        }
      }
    } catch (err) {
      console.warn("⚠️ Gagal memperbarui _ompimpa/stories.yaml untuk EPIC-DEBT:", err);
    }
  }

  // 2. Triage P2/P3 -> Update _ompimpa/deferred.md sesuai parser src/sweep.ts
  if (nonCriticalFindings.length > 0) {
    const deferredPath = path.join(targetDir, "_ompimpa", "deferred.md");
    try {
      let existingContent = "";
      try {
        existingContent = await fs.readFile(deferredPath, "utf-8");
      } catch {
        existingContent = `# Deferred Work — Antrian P2 / TechDebt (OMP Native)\n\n> **Sumber:** Triage P2 nits dari /ompimpa:inspect, di-sweep via \`ompimpa sweep\` ke \`ready-for-dev\`.\n\n## Queue — Open P2\n\n| ID | Title | Priority | Status | Source Story | Intent |\n|---|---|---|---|---|---|\n\n## Deferred Entries (YAML-like)\n\n`;
      }

      // Hitung next DW-XX ID dari berkas existing
      const dwMatches = existingContent.match(/- id:\s*DW-([A-Za-z0-9_-]+)/g) || [];
      let maxDwNum = 0;
      for (const m of dwMatches) {
        const numPart = m.replace(/- id:\s*DW-/, "").replace(/[^0-9]/g, "");
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxDwNum) maxDwNum = num;
      }

      let addition = "";
      const successfullyDeferred: InspeksiFinding[] = [];

      for (const f of nonCriticalFindings) {
        // Deduplikasi terhadap entri yang sudah ada di deferred.md
        if (existingContent.includes(f.title) || (addition && addition.includes(f.title))) {
          continue;
        }

        maxDwNum++;
        const dwId = `DW-${String(maxDwNum).padStart(2, "0")}`;

        addition += `- id: ${dwId}\n`;
        addition += `  title: "${f.title.replace(/"/g, "'")}"\n`;
        addition += `  priority: ${f.severity}\n`;
        addition += `  status: open\n`;
        addition += `  source: "/ompimpa:inspect"\n`;
        addition += `  intent: "${f.description.replace(/"/g, "'")}"\n\n`;

        successfullyDeferred.push(f);
      }

      if (addition) {
        await atomicWriteFile(deferredPath, existingContent + "\n" + addition);
      }
      deferredEntries.push(...successfullyDeferred);
    } catch (err) {
      console.warn("⚠️ Gagal mencatat temuan ke _ompimpa/deferred.md:", err);
    }
  }

  return { createdStories, deferredEntries };
}

/**
 * CLI runner untuk sub-command 'inspect' (dan alias backward-compat 'inspeksi').
 */
export async function handleInspect(
  args: string[] = [],
  repoRoot?: string
): Promise<InspeksiResult> {
  const targetDir = repoRoot || process.cwd();
  const dryRun = args.includes("--dry-run");

  let filterPillar: InspeksiPilar | undefined = undefined;
  if (args.includes("--boundaries") || args.includes("--batas")) filterPillar = "batas";
  else if (args.includes("--perf") || args.includes("--performa")) filterPillar = "performa";
  else if (args.includes("--keamanan") || args.includes("--security")) filterPillar = "keamanan";
  else if (args.includes("--docs") || args.includes("--doc")) filterPillar = "docs";

  console.log(`\n🔍 Running Master Diagnostic Out-of-Band (/ompimpa:inspect) in: ${targetDir}`);
  if (dryRun) {
    console.log(`   [DRY-RUN] Pratinjau pemindaian tanpa menulis ke stories.yaml atau deferred.md`);
  }
  if (filterPillar) {
    console.log(`   [FILTER] Hanya mengevaluasi pilar: ${filterPillar}`);
  }

  const result = await runInspeksi(targetDir, {
    dryRun,
    autoTriageDebt: !dryRun,
    filterPillar,
  });

  console.log(`\n📊 Scorecard Master Diagnostic 4 Pilar:`);
  console.log(`  • Batas (Boundary & Modular): ${result.scores.batas}/100`);
  console.log(`  • Performa (Latency & NFR):   ${result.scores.performa}/100`);
  console.log(`  • Keamanan (Security & Laws):  ${result.scores.keamanan}/100`);
  console.log(`  • Docs (Diátaxis 4 Kuadran):  ${result.scores.docs}/100`);
  console.log(`  • Overall Score:              ${result.scores.overall}/100`);
  console.log(`📄 Report: ${path.relative(targetDir, result.reportPath)}`);

  if (result.generatedStories.length > 0) {
    console.log(`\n⚡ [EPIC-DEBT] Otomatis menerbitkan ${result.generatedStories.length} User Story baru di stories.yaml:`);
    for (const s of result.generatedStories) {
      console.log(`  • [${s.id}] ${s.title}`);
    }
  }

  if (result.deferredEntries.length > 0) {
    console.log(`\n📋 [DEFERRED] ${result.deferredEntries.length} temuan non-kritis dicatat ke _ompimpa/deferred.md`);
  }

  return result;
}

/**
 * Alias backward compatibility untuk handleInspeksi
 */
export async function handleInspeksi(args: string[]): Promise<void> {
  await handleInspect(args);
}
