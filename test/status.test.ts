import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";

const REPO_ROOT = path.resolve(import.meta.dir, "..");

async function runCli(
  args: string[],
  cwd: string = REPO_ROOT
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { promise, resolve } = Promise.withResolvers<{ code: number; stdout: string; stderr: string }>();
  const proc = spawn("bun", ["run", path.join(REPO_ROOT, "src/cli.ts"), ...args], {
    cwd,
    stdio: "pipe",
  });
  let stdout = "";
  let stderr = "";
  proc.stdout?.on("data", (d) => (stdout += d.toString()));
  proc.stderr?.on("data", (d) => (stderr += d.toString()));
  proc.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  return promise;
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
    target_files: ["lib/t1.ex"]
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
    target_files: ["lib/t2.ex"]
    ac:
      - id: AC-T02-1
        given: "given"
        when: "when"
        then: "then"
`;

async function makeFixture(): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-status-"));
  await fs.mkdir(path.join(tmp, "_ompimpa", "status"), { recursive: true });
  await fs.mkdir(path.join(tmp, "_ompimpa", "specs"), { recursive: true });
  await fs.mkdir(path.join(tmp, "_ompimpa", "review"), { recursive: true });
  await fs.writeFile(path.join(tmp, "_ompimpa", "stories.yaml"), STORIES_YAML, "utf-8");
  await fs.writeFile(
    path.join(tmp, "_ompimpa", "status", "feature-status.yaml"),
    "stories:\n  - id: T-01\n    status: in-progress\n    retries: 1\n    epic: EPIC-T\n  - id: T-02\n    status: backlog\n    retries: 0\n    epic: EPIC-T\n",
    "utf-8"
  );
  await fs.writeFile(path.join(tmp, "_ompimpa", "specs", "SPEC-T-01.md"), "# SPEC-T-01\n", "utf-8");
  await fs.mkdir(path.join(tmp, "_ompimpa", "runs"), { recursive: true });
  await fs.writeFile(
    path.join(tmp, "_ompimpa", "runs", "T-01-dev.log"),
    "# dev session T-01 — completed (exit 0, 1000ms)\n--- stdout ---\nworking...\nall green\n",
    "utf-8"
  );
  await fs.writeFile(
    path.join(tmp, "_ompimpa", "review", "T-01-ompimpa-ironlaw.json"),
    JSON.stringify([
      {
        severity: "Low",
        file: "lib/t1.ex",
        line: 1,
        ruleId: "R1",
        message: "nit",
        recommendation: "rapikan",
        verdict: "low",
        evidence: "format",
      },
    ]),
    "utf-8"
  );
  await fs.writeFile(
    path.join(tmp, "_ompimpa", "review", "T-01.review.result.json"),
    JSON.stringify({ role: "review", story: "T-01", completed: true, files: ["T-01-ompimpa-ironlaw.json"] }),
    "utf-8"
  );
  return tmp;
}

describe("ompimpa status (read-only observability)", () => {
  it("status tanpa ID menampilkan kanban seluruh story + summary", async () => {
    const tmp = await makeFixture();
    try {
      const res = await runCli(["status"], tmp);
      expect(res.code).toBe(0);
      const out = res.stdout + res.stderr;
      expect(out).toContain("T-01");
      expect(out).toContain("T-02");
      expect(out).toContain("in-progress");
      expect(out).toContain("Summary:");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("status <ID> menampilkan SPEC, test, review evidence, triage, ledger, git", async () => {
    const tmp = await makeFixture();
    try {
      const res = await runCli(["status", "T-01"], tmp);
      expect(res.code).toBe(0);
      const out = res.stdout + res.stderr;
      expect(out).toContain("Story T-01");
      expect(out).toContain("in-progress");
      expect(out).toContain("SPEC-T-01.md");
      expect(out).toContain("Review evidence: marker ✅ completed");
      expect(out).toContain("ompimpa-ironlaw");
      expect(out).toContain("Triage:");
      expect(out).toContain("Run ledger:");
      expect(out).toContain("Git commit:");
      expect(out).toContain("Git worktree:");
      expect(out).toContain("Log dev:");
      expect(out).toContain("all green");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("status <ID> tanpa marker menandai review tanpa bukti", async () => {
    const tmp = await makeFixture();
    try {
      await fs.rm(path.join(tmp, "_ompimpa", "review", "T-01.review.result.json"));
      const res = await runCli(["status", "T-01"], tmp);
      expect(res.code).toBe(0);
      expect(res.stdout + res.stderr).toContain("tanpa marker sesi");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("status ID tak dikenal gagal eksplisit dan read-only (tidak menulis)", async () => {
    const tmp = await makeFixture();
    try {
      const before = await fs.readFile(path.join(tmp, "_ompimpa", "status", "feature-status.yaml"), "utf-8");
      const res = await runCli(["status", "NOPE-99"], tmp);
      expect(res.code).toBe(1);
      const after = await fs.readFile(path.join(tmp, "_ompimpa", "status", "feature-status.yaml"), "utf-8");
      expect(after).toBe(before);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
