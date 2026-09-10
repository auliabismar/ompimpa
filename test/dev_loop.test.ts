import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";
import { runStoryPhases, commitStoryChanges, type SubprocessExecutor } from "../src/loop_runner";

const REPO_ROOT = path.resolve(import.meta.dir, "..");

async function runCli(
  args: string[],
  cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("bun", ["run", path.join(REPO_ROOT, "src/cli.ts"), ...args], {
      cwd,
      stdio: "pipe",
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

const STORIES_YAML = `epics:
  - id: EPIC-T
    title: "Test Epic"
    description: "Fixture"
stories:
  - id: T-01
    epic: EPIC-T
    title: "Story uji"
    description: "Deskripsi uji"
    tea_tier: "P0"
    priority: "P0"
    depends_on: []
    target_files: ["src/t1.ts"]
    ac:
      - id: AC-T01-1
        given: "given"
        when: "when"
        then: "then"
  - id: T-02
    epic: EPIC-T
    title: "Story uji 2"
    description: "Deskripsi uji 2"
    tea_tier: "P1"
    priority: "P1"
    depends_on: ["T-01"]
    target_files: ["src/t2.ts"]
    ac:
      - id: AC-T02-1
        given: "given"
        when: "when"
        then: "then"
`;

async function makeFixture(withSpec: boolean, withTestFile: boolean): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-devloop-"));
  await fs.mkdir(path.join(tmp, "_ompimpa", "status"), { recursive: true });
  await fs.mkdir(path.join(tmp, "src"), { recursive: true });
  await fs.mkdir(path.join(tmp, "test"), { recursive: true });
  await fs.writeFile(path.join(tmp, "_ompimpa", "stories.yaml"), STORIES_YAML, "utf-8");
  await fs.writeFile(
    path.join(tmp, "_ompimpa", "status", "feature-status.yaml"),
    "stories:\n  - id: T-01\n    status: backlog\n    retries: 0\n    epic: EPIC-T\n",
    "utf-8"
  );
  if (withSpec) {
    await fs.mkdir(path.join(tmp, "_ompimpa", "specs"), { recursive: true });
    await fs.writeFile(path.join(tmp, "_ompimpa", "specs", "SPEC-T-01.md"), "# SPEC-T-01\n", "utf-8");
  }
  if (withTestFile) {
    await fs.writeFile(path.join(tmp, "test", "t1.test.ts"), "import { test, expect } from 'bun:test';\ntest('x', () => expect(1).toBe(1));\n", "utf-8");
  }
  return tmp;
}

describe("Dev loop 5 fase (story → atdd → code → review → triage)", () => {
  it("runStoryPhases memuat 5 fase berurutan termasuk atdd (dry-run)", async () => {
    const res = await runStoryPhases("T-01", { targetDir: REPO_ROOT, dryRun: true });
    expect(res.success).toBeTrue();
    expect(res.phases.map((p) => p.phase)).toEqual(["story", "atdd", "code", "review", "triage"]);
  });

  it("ompimpa atdd tanpa SPEC gagal cepat (INV-09)", async () => {
    const tmp = await makeFixture(false, false);
    try {
      const res = await runCli(["atdd", "T-01"], tmp);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("INV-09");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("ompimpa atdd dengan SPEC tapi tes belum di-scaffold gagal (belum merah)", async () => {
    const tmp = await makeFixture(true, false);
    try {
      const res = await runCli(["atdd", "T-01"], tmp);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("belum di-scaffold");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
  it("ompimpa atdd dengan flag --auto otomatis men-scaffold berkas tes yang hilang", async () => {
    const tmp = await makeFixture(true, false);
    try {
      const res = await runCli(["atdd", "T-01", "--auto"], tmp);
      expect(res.code).toBe(0);
      expect(res.stdout).toContain("Auto-scaffolding");
      const status = await fs.readFile(path.join(tmp, "_ompimpa", "status", "feature-status.yaml"), "utf-8");
      expect(status).toContain("status: ready-for-dev");
      const testFileContent = await fs.readFile(path.join(tmp, "test", "t1.test.ts"), "utf-8");
      expect(testFileContent).toContain("Red-Phase ATDD");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("ompimpa atdd lengkap → exit 0 dan status ready-for-dev", async () => {
    const tmp = await makeFixture(true, true);
    try {
      const res = await runCli(["atdd", "T-01"], tmp);
      expect(res.code).toBe(0);
      const status = await fs.readFile(path.join(tmp, "_ompimpa", "status", "feature-status.yaml"), "utf-8");
      expect(status).toContain("status: ready-for-dev");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("ompimpa review --story tanpa berkas isolated → BLOCKED exit 1 (fail-closed)", async () => {
    const tmp = await makeFixture(true, true);
    try {
      const res = await runCli(["review", "--story", "T-01"], tmp);
      expect(res.code).toBe(1);
      expect(res.stdout + res.stderr).toContain("Review must be isolated via task");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("ompimpa dev --story tidak dikenal gagal cepat", async () => {
    const tmp = await makeFixture(false, false);
    try {
      const res = await runCli(["dev", "--story", "NOPE-99"], tmp);
      expect(res.code).toBe(1);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("ompimpa dev --story terblokir bila dependensi belum done", async () => {
    const tmp = await makeFixture(false, false);
    try {
      const res = await runCli(["dev", "--story", "T-02"], tmp);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("Blocked");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("ompimpa inventory: risalah baik + PRD penuh → exit 0", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-inv-"));
    try {
      await fs.writeFile(
        path.join(tmp, "risalah.md"),
        "# R\n\n## Tabel Inventaris Modul & Rute\n\n| Modul | Rute Index | Komponen |\n|---|---|---|\n| Jurnal | /jurnal | form_workspace |\n"
      );
      await fs.writeFile(path.join(tmp, "prd.md"), "# PRD\n\nModul Jurnal di /jurnal.\n");
      const res = await runCli(["inventory", "--balairung", "risalah.md", "--prd", "prd.md"], tmp);
      expect(res.code).toBe(0);
      expect(res.stdout).toContain("Cakupan PRD penuh");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("ompimpa inventory: sapu-jagat tanpa tabel → exit 1", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-inv-"));
    try {
      await fs.writeFile(path.join(tmp, "risalah.md"), "# R\n\nDiputuskan seluruh formulir 100%.\n");
      const res = await runCli(["inventory", "--balairung", "risalah.md"], tmp);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("Inventaris");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("ompimpa inventory: scope-truncation (modul hilang dari PRD) → exit 1", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-inv-"));
    try {
      await fs.writeFile(
        path.join(tmp, "risalah.md"),
        "# R\n\n## Inventaris\n\n| Modul | Rute |\n|---|---|\n| Jurnal | /jurnal |\n| Faktur | /faktur |\n"
      );
      await fs.writeFile(path.join(tmp, "prd.md"), "# PRD\n\nHanya Jurnal.\n");
      const res = await runCli(["inventory", "--balairung", "risalah.md", "--prd", "prd.md"], tmp);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("Faktur");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
  it("commitStoryChanges: menghasilkan Semantic Commit Message feat/refactor dan memanggil git commit", async () => {
    const tmp = await makeFixture(true, true);
    const executed: Array<{ cmd: string; args: string[] }> = [];
    const mockExecutor: SubprocessExecutor = async (cmd: string, args: string[]) => {
      executed.push({ cmd, args });
      if (args[0] === "diff") return { code: 1, stdout: "M file.txt", stderr: "" };
      return { code: 0, stdout: "[commit ok]", stderr: "" };
    };

    try {
      await fs.mkdir(path.join(tmp, ".git"), { recursive: true });
      const res = await commitStoryChanges(tmp, "T-01", mockExecutor);
      expect(res.success).toBeTrue();
      expect(res.commitMessage).toContain("feat(t): Story uji (T-01)");

      expect(executed.some((e) => e.cmd === "git" && e.args[0] === "add")).toBeTrue();
      const commitCall = executed.find((e) => e.cmd === "git" && e.args[0] === "commit");
      expect(commitCall).toBeDefined();
      expect(commitCall!.args).toContain("-m");
      expect(commitCall!.args.some((a) => a.includes("feat(t): Story uji (T-01)"))).toBeTrue();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
