import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import yaml from "yaml";
import {
  runInspeksi,
  generateDebtStories,
  type InspeksiResult,
  type InspeksiFinding,
  type InspeksiOptions,
} from "../src/inspeksi";
import { handleInspect } from "../src/cli";

const REPO_ROOT = path.resolve(import.meta.dir, "..");

describe("Story E-03: Master Diagnostic Out-of-Band (/ompimpa:inspect) (ATDD Red-Phase)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-inspect-test-"));
    // Setup minimal _ompimpa structure in tmpDir
    await fs.mkdir(path.join(tmpDir, "_ompimpa", "status"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "rules"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "docs"), { recursive: true });

    // Initial stories.yaml
    const initialStories = {
      epics: [
        { id: "EPIC-A", title: "Governance Spine", description: "Governance desc" },
      ],
      stories: [
        {
          id: "A-01",
          epic: "EPIC-A",
          title: "Initial Story",
          description: "Initial description",
          tea_tier: "P0",
          priority: "P0",
          depends_on: [],
          target_files: ["rules/01-no-float.md"],
          ac: [
            {
              id: "AC-A01-1",
              given: "initial condition",
              when: "something happens",
              then: "expected outcome",
            },
          ],
        },
      ],
    };
    await fs.writeFile(
      path.join(tmpDir, "_ompimpa", "stories.yaml"),
      yaml.stringify(initialStories),
      "utf-8"
    );

    // Initial feature-status.yaml
    const initialStatus = {
      stories: [
        { id: "A-01", title: "Initial Story", status: "in-progress", retries: 0 },
      ],
    };
    await fs.writeFile(
      path.join(tmpDir, "_ompimpa", "status", "feature-status.yaml"),
      yaml.stringify(initialStatus),
      "utf-8"
    );

    // Initial ompimpa.toml with tiered verification
    await fs.writeFile(
      path.join(tmpDir, "ompimpa.toml"),
      `[quality.verify.tier1]\nsteps = ["compile"]\n\n[quality.verify.tier2]\nsteps = ["test"]\n`,
      "utf-8"
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("1. Kriteria Penerimaan AC-E03-1: Deteksi P0/P1 Boundaries & Perf -> Triage & Auto-Generate EPIC-DEBT", () => {
    it("@ac-e03-1 @tea-01 mendeteksi circular dependency (P0 boundaries) dan otomatis menerbitkan story DEBT di stories.yaml", async () => {
      // Buat graph.json dengan circular dependency
      const graph = {
        circular_check: {
          hasCycle: true,
          cycle: ["App.Accounts", "App.Orders", "App.Accounts"],
        },
        nodes: 10,
        edges: 15,
        boundary_violations: [
          { from: "App.Accounts", to: "App.Orders", reason: "Cross-context boundary violation" },
        ],
        stats: { elapsed_ms: 120, method: "mix_xref" },
      };
      await fs.writeFile(
        path.join(tmpDir, "_ompimpa", "graph.json"),
        JSON.stringify(graph),
        "utf-8"
      );

      const result = await runInspeksi(tmpDir, { autoTriageDebt: true });

      // Verifikasi skor batas terdampak
      expect(result.scores.batas).toBeLessThan(80);
      expect(result.findings).toBeDefined();

      // Temuan boundaries P0 harus ada
      const p0Boundary = result.findings.find(
        (f) => f.pillar === "batas" && (f.severity === "P0" || f.severity === "P1")
      );
      expect(p0Boundary).toBeDefined();
      expect(p0Boundary?.description).toContain("Circular dependency");

      // Verifikasi bahwa story perbaikan telah otomatis di-generate
      expect(result.generatedStories.length).toBeGreaterThanOrEqual(1);
      const generated = result.generatedStories[0];
      expect(generated.epic).toBe("EPIC-DEBT");
      expect(generated.id).toMatch(/^DEBT-/);

      // Verifikasi berkas _ompimpa/stories.yaml telah memuat EPIC-DEBT dan story perbaikan
      const updatedStoriesRaw = await fs.readFile(
        path.join(tmpDir, "_ompimpa", "stories.yaml"),
        "utf-8"
      );
      const updatedStories = yaml.parse(updatedStoriesRaw);

      const epicDebt = updatedStories.epics.find((e: any) => e.id === "EPIC-DEBT");
      expect(epicDebt).toBeDefined();
      expect(epicDebt.title).toContain("Hutang Teknis");

      const debtStory = updatedStories.stories.find(
        (s: any) => s.id === generated.id
      );
      expect(debtStory).toBeDefined();
      expect(debtStory.epic).toBe("EPIC-DEBT");
      expect(debtStory.ac).toBeDefined();
      expect(debtStory.ac.length).toBeGreaterThan(0);
      expect(debtStory.ac[0].given).toBeDefined();
      expect(debtStory.ac[0].when).toBeDefined();
      expect(debtStory.ac[0].then).toBeDefined();
    });

    it("@ac-e03-1 @tea-01 mendeteksi pelanggaran performa P1 (latency NFR >2000ms) dan otomatis membuat story DEBT", async () => {
      // Graph dengan elapsed_ms 3500ms (>2000ms NFR)
      const graph = {
        circular_check: { hasCycle: false },
        nodes: 50,
        edges: 120,
        stats: { elapsed_ms: 3500, method: "mix_xref" },
      };
      await fs.writeFile(
        path.join(tmpDir, "_ompimpa", "graph.json"),
        JSON.stringify(graph),
        "utf-8"
      );

      const result = await runInspeksi(tmpDir, { autoTriageDebt: true });

      expect(result.scores.performa).toBeLessThan(100);
      const perfFinding = result.findings.find(
        (f) => f.pillar === "performa" && f.description.includes("graphify >2s")
      );
      expect(perfFinding).toBeDefined();
      expect(perfFinding?.description).toContain("graphify >2s");

      // Verifikasi auto-generate story DEBT
      const perfDebtStory = result.generatedStories.find((s) =>
        s.title.toLowerCase().includes("performa") || s.title.toLowerCase().includes("latency")
      );
      expect(perfDebtStory).toBeDefined();
    });

    it("mematuhi Invariant INV-11 (Out-of-Band Inspection Isolation): status story aktif di feature-status.yaml TIDAK berubah", async () => {
      // Graph dengan cycle (P0 Blocker)
      const graph = {
        circular_check: {
          hasCycle: true,
          cycle: ["A", "B", "A"],
        },
        stats: { elapsed_ms: 100 },
      };
      await fs.writeFile(
        path.join(tmpDir, "_ompimpa", "graph.json"),
        JSON.stringify(graph),
        "utf-8"
      );

      await runInspeksi(tmpDir, { autoTriageDebt: true });

      // Status story aktif harus tetap utuh "in-progress", tidak berubah jadi blocked/remediate
      const statusRaw = await fs.readFile(
        path.join(tmpDir, "_ompimpa", "status", "feature-status.yaml"),
        "utf-8"
      );
      const status = yaml.parse(statusRaw);
      expect(status.stories[0].id).toBe("A-01");
      expect(status.stories[0].status).toBe("in-progress");
    });
  });

  describe("2. Triage Temuan P2/P3 ke _ompimpa/deferred.md", () => {
    it("mencatat temuan P2/P3 non-kritis ke deferred.md tanpa membuat story di stories.yaml", async () => {
      const findings: InspeksiFinding[] = [
        {
          pillar: "docs",
          severity: "P2",
          title: "Dokumentasi Diátaxis Kuadran Explanation Kurang Lengkap",
          description: "Kuadran explanation belum memiliki dokumen arsitektur",
          remediation: "Tambahkan dokumen arsitektur di docs/explanation/",
        },
        {
          pillar: "keamanan",
          severity: "P3",
          title: "Credo/Sobelow linter config minor note",
          description: "Format konfirmasi minor pada ompimpa.toml",
        },
      ];

      const res = await generateDebtStories(findings, tmpDir);
      expect(res.createdStories.length).toBe(0); // Tidak membuat story untuk P2/P3
      expect(res.deferredEntries.length).toBe(2);

      const deferredPath = path.join(tmpDir, "_ompimpa", "deferred.md");
      const deferredContent = await fs.readFile(deferredPath, "utf-8");
      expect(deferredContent).toContain("Dokumentasi Diátaxis Kuadran Explanation");
      expect(deferredContent).toContain("Credo/Sobelow linter config");

      // Verifikasi kompatibilitas format terhadap parser src/sweep.ts
      const { parseDeferredMd } = await import("../src/sweep");
      const parsedEntries = parseDeferredMd(deferredContent);
      expect(parsedEntries.length).toBeGreaterThanOrEqual(2);
      const dwEntry = parsedEntries.find((e) => e.title.includes("Diátaxis"));
      expect(dwEntry).toBeDefined();
      expect(dwEntry?.priority).toBe("P2");
      expect(dwEntry?.status).toBe("open");
      expect(dwEntry?.source).toBe("/ompimpa:inspect");
    });
  });
  describe("3. Verifikasi Kontrak Spesifikasi Berkas Perintah commands/inspect.md", () => {
    it("commands/inspect.md memuat metadata /ompimpa:inspect, unifikasi 4 pilar, INV-11, dan EPIC-DEBT", async () => {
      const inspectMdPath = path.join(REPO_ROOT, "commands", "inspect.md");
      const exists = await fs.stat(inspectMdPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(inspectMdPath, "utf-8");
      expect(content).toContain("# Command: /ompimpa:inspect");
      expect(content).toContain("/inspect");
      expect(content).toContain("Batas");
      expect(content).toContain("Performa");
      expect(content).toContain("Keamanan");
      expect(content).toContain("Docs");
      expect(content).toContain("EPIC-DEBT");
      expect(content).toContain("INV-11");
    });
  });

  describe("4. Integrasi Sub-Command CLI: ompimpa inspect", () => {
    it("handleInspect mengeksekusi master diagnostic dan mengembalikan hasil inspeksi lengkap", async () => {
      const result = await handleInspect(["--dry-run"], tmpDir);
      expect(result).toBeDefined();
      expect(result.scores).toBeDefined();
      expect(result.scores.overall).toBeGreaterThanOrEqual(0);
      expect(result.reportPath).toContain("report.md");
    });

    it("src/cli.ts mendaftarkan sub-command inspect pada bantuan CLI", async () => {
      const cliPath = path.join(REPO_ROOT, "src", "cli.ts");
      const cliCode = await fs.readFile(cliPath, "utf-8");
      expect(cliCode).toContain('case "inspect":');
      expect(cliCode).toContain("handleInspect");
      expect(cliCode).toContain("inspect");
    });
    it("handleInspect mendukung flag selektif pilar (--boundaries, --perf, --keamanan, --docs)", async () => {
      const resBatas = await handleInspect(["--dry-run", "--boundaries"], tmpDir);
      expect(resBatas.scores.overall).toBe(resBatas.scores.batas);

      const resPerf = await handleInspect(["--dry-run", "--perf"], tmpDir);
      expect(resPerf.scores.overall).toBe(resPerf.scores.performa);
    });

    it("mendeteksi siklus dependensi (circular DAG) pada stories.yaml", async () => {
      const cyclicStories = {
        stories: [
          { id: "S-01", depends_on: ["S-02"] },
          { id: "S-02", depends_on: ["S-01"] },
        ],
      };
      await fs.writeFile(
        path.join(tmpDir, "_ompimpa", "stories.yaml"),
        yaml.stringify(cyclicStories),
        "utf-8"
      );

      const res = await runInspeksi(tmpDir, { autoTriageDebt: false, filterPillar: "batas" });
      const cycleFinding = res.findings.find(
        (f) => f.pillar === "batas" && f.ruleId === "TEA-16" && f.severity === "P0"
      );
      expect(cycleFinding).toBeDefined();
      expect(cycleFinding?.description).toContain("Terdeteksi ketergantungan melingkar pada stories.yaml");
    });
  });

  describe("5. Utilitas Atomik atomicWriteFile", () => {
    it("menulis payload secara atomik tanpa merusak berkas asli jika terjadi gangguan", async () => {
      const { atomicWriteFile } = await import("../src/inspeksi");
      const testFile = path.join(tmpDir, "atomic-test.txt");
      await atomicWriteFile(testFile, "initial content");
      const read1 = await fs.readFile(testFile, "utf-8");
      expect(read1).toBe("initial content");

      await atomicWriteFile(testFile, "updated content");
      const read2 = await fs.readFile(testFile, "utf-8");
      expect(read2).toBe("updated content");
    });
  });
});
