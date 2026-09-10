import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  buildOmpArgv,
  runHarnessSession,
  HARNESS_TIMEOUT_EXIT_CODE,
  type HarnessExecutor,
  type HarnessSessionSpec,
} from "../src/harness/omp_adapter";
import { buildDevPrompt, buildReviewPrompt } from "../src/harness/prompts";
import { aggregateReviews, auditResidualFlunk } from "../src/triage";
import { appendSpecLedger, commitStoryChanges, runEpicLoop } from "../src/loop_runner";
import type { StoryDetail } from "../src/story_spec";

function baseSpec(over: Partial<HarnessSessionSpec> = {}): HarnessSessionSpec {
  return {
    role: "dev",
    storyId: "T-01",
    targetDir: "/tmp/ompimpa-harness-test",
    prompt: "do the work",
    markerFile: "_ompimpa/runs/T-01-dev.result.json",
    ...over,
  };
}

const okExecutor: HarnessExecutor = async () => ({ code: 0, stdout: "done", stderr: "" });

describe("Harness adapter: argv + completion contract", () => {
  it("buildOmpArgv memakai -p --mode json --auto-approve, model, max-time, prompt terakhir", () => {
    const argv = buildOmpArgv(baseSpec({ model: "smol", timeoutMs: 600_000 }));
    expect(argv[0]).toBe("-p");
    expect(argv).toContain("--mode");
    expect(argv).toContain("json");
    expect(argv).toContain("--auto-approve");
    expect(argv).toContain("--model");
    expect(argv).toContain("smol");
    expect(argv).toContain("--max-time");
    expect(argv[argv.length - 1]).toBe("do the work");
  });

  it("completed bila exit 0 + marker valid cocok role/story", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-harness-ok-"));
    const markerRel = "_ompimpa/runs/T-01-dev.result.json";
    await fs.mkdir(path.join(tmp, "_ompimpa", "runs"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, markerRel),
      JSON.stringify({ role: "dev", story: "T-01", completed: true, tests: { argv: ["true"], exit: 0 } }),
      "utf-8"
    );
    const res = await runHarnessSession({ ...baseSpec(), targetDir: tmp, markerFile: markerRel }, okExecutor);
    expect(res.status).toBe("completed");
    expect(res.marker?.completed).toBeTrue();
    const logContent = await fs.readFile(path.join(tmp, "_ompimpa", "runs", "T-01-dev.log"), "utf-8");
    expect(logContent).toContain("completed");
    expect(logContent).toContain("done");
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("no-marker bila exit 0 tanpa file marker", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-harness-nomarker-"));
    const res = await runHarnessSession({ ...baseSpec(), targetDir: tmp }, okExecutor);
    expect(res.status).toBe("no-marker");
    expect(res.marker).toBeNull();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("no-marker bila marker role/story mismatch", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-harness-mismatch-"));
    const markerRel = "_ompimpa/runs/T-01-dev.result.json";
    await fs.mkdir(path.join(tmp, "_ompimpa", "runs"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, markerRel),
      JSON.stringify({ role: "review", story: "OTHER", completed: true }),
      "utf-8"
    );
    const res = await runHarnessSession({ ...baseSpec(), targetDir: tmp, markerFile: markerRel }, okExecutor);
    expect(res.status).toBe("no-marker");
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("timeout dipetakan dari exit 124", async () => {
    const timeoutExecutor: HarnessExecutor = async () => ({
      code: HARNESS_TIMEOUT_EXIT_CODE,
      stdout: "",
      stderr: "[TIMEOUT] Execution timed out after 600000ms",
    });
    const res = await runHarnessSession(baseSpec(), timeoutExecutor);
    expect(res.status).toBe("timeout");
  });

  it("error bila exit non-nol", async () => {
    const failExecutor: HarnessExecutor = async () => ({ code: 1, stdout: "", stderr: "boom" });
    const res = await runHarnessSession(baseSpec(), failExecutor);
    expect(res.status).toBe("error");
    expect(res.exitCode).toBe(1);
  });
});

const demoStory = {
  id: "T-01",
  epic: "EPIC-T",
  title: "Story uji",
  description: "Deskripsi",
  tea_tier: "P0",
  priority: "P0",
  depends_on: [],
  target_files: ["lib/t1.ex"],
  ac: [{ id: "AC-T01-1", given: "given", when: "when", then: "then" }],
} as StoryDetail;

describe("Prompt kontrak sesi", () => {
  it("dev prompt memuat kurungan: target files, larangan commit/full-suite, marker", () => {
    const prompt = buildDevPrompt({
      story: demoStory,
      specRel: "_ompimpa/specs/SPEC-T-01.md",
      targetFiles: ["lib/t1.ex"],
      testFiles: ["test/t1_test.exs"],
      scopedTest: "mix test test/t1_test.exs --include atdd",
      markerRel: "_ompimpa/runs/T-01-dev.result.json",
    });
    expect(prompt).toContain("lib/t1.ex");
    expect(prompt).toContain("Dilarang git commit");
    expect(prompt).toContain("Dilarang menjalankan full test suite");
    expect(prompt).toContain("MERAH dulu");
    expect(prompt).toContain("_ompimpa/runs/T-01-dev.result.json");
    expect(prompt).toContain('"role":"dev"');
  });

  it("review prompt read-only, fan-out task, skema verdict+evidence", () => {
    const prompt = buildReviewPrompt({
      story: demoStory,
      specRel: "_ompimpa/specs/SPEC-T-01.md",
      targetFiles: ["lib/t1.ex"],
      testFiles: ["test/t1_test.exs"],
      reviewDirRel: "_ompimpa/review",
      reviewerIds: ["ompimpa-ironlaw", "ompimpa-security"],
      markerRel: "_ompimpa/review/T-01.review.result.json",
    });
    expect(prompt).toContain("READ-ONLY");
    expect(prompt).toContain("tool task");
    expect(prompt).toContain("verdict");
    expect(prompt).toContain("false|maybe-false");
    expect(prompt).toContain("dilarang mengubah file");
  });
});

describe("Triage kontrak jujur", () => {
  it("temuan bervonis false masuk rejected dan tidak ikut skor", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-verdict-"));
    const reviewDir = path.join(tmp, "_ompimpa", "review");
    await fs.mkdir(reviewDir, { recursive: true });
    await fs.writeFile(
      path.join(reviewDir, "V-01-ompimpa-ironlaw.json"),
      JSON.stringify([
        {
          severity: "Critical",
          file: "lib/a.ex",
          line: 1,
          ruleId: "R1",
          message: "klaim palsu",
          recommendation: "abaikan",
          verdict: "false",
          evidence: "guard di hulu menolak input ini",
        },
      ]),
      "utf-8"
    );
    const agg = await aggregateReviews("V-01", { targetDir: tmp, panelIds: ["ompimpa-ironlaw"] });
    expect(agg.rejected.length).toBe(1);
    expect(agg.deduped.length).toBe(0);
    expect(agg.score.score).toBe(100);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("auditResidualFlunk menemukan sisa flunk() ter-scope file story", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-flunk-"));
    await fs.mkdir(path.join(tmp, "test"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "test", "t1_test.exs"),
      'defmodule T1Test do\n  use ExUnit.Case\n  test "x" do\n    flunk("belum")\n  end\nend\n',
      "utf-8"
    );
    const findings = await auditResidualFlunk("T-01", { repoRoot: tmp, testFiles: ["test/t1_test.exs"] });
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("High");
    expect(findings[0].line).toBe(4);
    await fs.rm(tmp, { recursive: true, force: true });
  });
});

describe("SPEC ledger + commit eksplisit", () => {
  it("appendSpecLedger menambahkan §12 tanpa menyentuh intent", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-ledger-"));
    await fs.mkdir(path.join(tmp, "_ompimpa", "specs"), { recursive: true });
    await fs.writeFile(path.join(tmp, "_ompimpa", "specs", "SPEC-T-01.md"), "# SPEC-T-01\n", "utf-8");
    await appendSpecLedger(tmp, "T-01", ["done (triage 100/100, retries 0)"]);
    const content = await fs.readFile(path.join(tmp, "_ompimpa", "specs", "SPEC-T-01.md"), "utf-8");
    expect(content).toContain("## 12. Run Ledger");
    expect(content).toContain("done (triage 100/100, retries 0)");
    expect(content).toContain("# SPEC-T-01");
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("commit gagal = runEpicLoop berhenti eksplisit, bukan menumpuk diam-diam", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-commitfail-"));
    await fs.mkdir(path.join(tmp, "_ompimpa", "status"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "_ompimpa", "stories.yaml"),
      "epics:\n  - id: EPIC-T\n    title: T\n    description: T\nstories:\n  - id: T-01\n    epic: EPIC-T\n    title: Story uji\n    description: D\n    tea_tier: P0\n    priority: P0\n    depends_on: []\n    target_files: [\"lib/t1.ex\"]\n    ac:\n      - id: AC-T01-1\n        given: g\n        when: w\n        then: t\n",
      "utf-8"
    );
    await fs.writeFile(
      path.join(tmp, "_ompimpa", "status", "feature-status.yaml"),
      "stories:\n  - id: T-01\n    status: ready-for-dev\n    retries: 0\n    epic: EPIC-T\n",
      "utf-8"
    );
    await fs.mkdir(path.join(tmp, ".git"), { recursive: true });
    const calls: string[][] = [];
    const mockExecutor: HarnessExecutor = async (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      if (cmd === "bun") return { code: 0, stdout: "Score: 100/100", stderr: "" };
      if (cmd === "git" && args[0] === "diff") return { code: 1, stdout: "M x", stderr: "" };
      if (cmd === "git" && args[0] === "commit") return { code: 1, stdout: "", stderr: "pre-commit hook failed" };
      return { code: 0, stdout: "", stderr: "" };
    };
    const res = await runEpicLoop({ epicId: "EPIC-T", targetDir: tmp, executor: mockExecutor });
    expect(res.success).toBeFalse();
    expect(res.message).toContain("commit failed");
    expect(calls.some((c) => c[0] === "git" && c[1] === "commit")).toBeTrue();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("commitStoryChanges sukses diam bila tak ada perubahan staged", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-commitok-"));
    await fs.mkdir(path.join(tmp, "_ompimpa", "status"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "_ompimpa", "stories.yaml"),
      "epics:\n  - id: EPIC-T\n    title: T\n    description: T\nstories:\n  - id: T-01\n    epic: EPIC-T\n    title: Story uji\n    description: D\n    tea_tier: P0\n    priority: P0\n    depends_on: []\n    target_files: [\"lib/t1.ex\"]\n    ac:\n      - id: AC-T01-1\n        given: g\n        when: w\n        then: t\n",
      "utf-8"
    );
    await fs.mkdir(path.join(tmp, ".git"), { recursive: true });
    const quietExecutor: HarnessExecutor = async () => ({ code: 0, stdout: "", stderr: "" });
    const res = await commitStoryChanges(tmp, "T-01", quietExecutor);
    expect(res.success).toBeTrue();
    await fs.rm(tmp, { recursive: true, force: true });
  });
});

describe("Wiring harness ke runStoryPhases", () => {
  const STORIES_YAML = `epics:
  - id: EPIC-T
    title: "T"
    description: "T"
stories:
  - id: T-01
    epic: EPIC-T
    title: "Story uji"
    description: "D"
    tea_tier: "P0"
    priority: "P0"
    depends_on: []
    target_files: ["lib/t1.ex"]
    ac:
      - id: AC-T01-1
        given: g
        when: w
        then: t
`;

  async function makeStoryFixture(): Promise<string> {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-harness-wire-"));
    await fs.mkdir(path.join(tmp, "_ompimpa", "status"), { recursive: true });
    await fs.writeFile(path.join(tmp, "_ompimpa", "stories.yaml"), STORIES_YAML, "utf-8");
    return tmp;
  }

  it("fase code/review via sesi mock completed → 5 fase sukses, cmd tercatat omp", async () => {
    const tmp = await makeStoryFixture();
    try {
      const roles: string[] = [];
      const { runStoryPhases } = await import("../src/loop_runner");
      const res = await runStoryPhases("T-01", {
        targetDir: tmp,
        executor: async () => ({ code: 0, stdout: "Score: 100/100", stderr: "" }),
        harness: {
          enabled: true,
          runSession: async (spec, _exec) => {
            roles.push(spec.role);
            if (spec.role === "dev") {
              await fs.mkdir(path.join(tmp, "_ompimpa", "runs"), { recursive: true });
              await fs.writeFile(
                path.join(tmp, spec.markerFile),
                JSON.stringify({ role: "dev", story: "T-01", completed: true, tests: { argv: ["true"], exit: 0 } }),
                "utf-8"
              );
            } else {
              await fs.mkdir(path.join(tmp, "_ompimpa", "review"), { recursive: true });
              await fs.writeFile(
                path.join(tmp, "_ompimpa", "review", "T-01-ompimpa-ironlaw.json"),
                JSON.stringify([{ severity: "Low", file: "lib/t1.ex", line: 1, ruleId: "R1", message: "nit", recommendation: "rapikan", verdict: "low", evidence: "format" }]),
                "utf-8"
              );
              await fs.writeFile(
                path.join(tmp, spec.markerFile),
                JSON.stringify({ role: "review", story: "T-01", completed: true, files: ["T-01-ompimpa-ironlaw.json"] }),
                "utf-8"
              );
            }
            return { status: "completed", exitCode: 0, marker: spec.role === "dev" ? { role: "dev", story: "T-01", completed: true, tests: { argv: ["true"], exit: 0 } } : { role: "review", story: "T-01", completed: true, files: ["T-01-ompimpa-ironlaw.json"] }, stdoutTail: "", stderrTail: "", durationMs: 1 } as never;
          },
        },
      });
      expect(roles).toEqual(["dev", "review"]);
      expect(res.success).toBeTrue();
      expect(res.phases.map((p) => p.phase)).toEqual(["story", "atdd", "code", "review", "triage"]);
      expect(res.phases.find((p) => p.phase === "code")?.cmd).toBe("omp");
      expect(res.phases.find((p) => p.phase === "review")?.cmd).toBe("omp");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("sesi dev tanpa marker → fase code gagal eksplisit", async () => {
    const tmp = await makeStoryFixture();
    try {
      const { runStoryPhases } = await import("../src/loop_runner");
      const res = await runStoryPhases("T-01", {
        targetDir: tmp,
        executor: async () => ({ code: 0, stdout: "", stderr: "" }),
        harness: {
          enabled: true,
          runSession: async () => ({ status: "no-marker", exitCode: 0, marker: null, stdoutTail: "prosa", stderrTail: "", durationMs: 1 }),
        },
      });
      expect(res.success).toBeFalse();
      expect(res.error).toContain("no-marker");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("Kontrak envelope review", () => {
  async function makeReviewFixture(): Promise<{ tmp: string; reviewDir: string }> {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-envelope-"));
    const reviewDir = path.join(tmp, "_ompimpa", "review");
    await fs.mkdir(reviewDir, { recursive: true });
    return { tmp, reviewDir };
  }

  const markerFor = (files: string[]) => ({ role: "review", story: "W-01", completed: true, files });

  it("envelope bersih + marker → PASS tanpa temuan", async () => {
    const { tmp, reviewDir } = await makeReviewFixture();
    try {
      await fs.writeFile(
        path.join(reviewDir, "W-01-ompimpa-ironlaw.json"),
        JSON.stringify({ reviewer: "ompimpa-ironlaw", story: "W-01", completedAt: "2026-09-08T00:00:00Z", findings: [] }),
        "utf-8"
      );
      const agg = await aggregateReviews("W-01", {
        targetDir: tmp,
        panelIds: ["ompimpa-ironlaw"],
        sessionMarker: markerFor(["W-01-ompimpa-ironlaw.json"]),
      });
      expect(agg.score.verdict).toBe("PASS");
      expect(agg.deduped.length).toBe(0);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("envelope bersih tanpa marker → REMEDIATE no-evidence", async () => {
    const { tmp, reviewDir } = await makeReviewFixture();
    try {
      await fs.writeFile(
        path.join(reviewDir, "W-01-ompimpa-ironlaw.json"),
        JSON.stringify({ reviewer: "ompimpa-ironlaw", story: "W-01", completedAt: "2026-09-08T00:00:00Z", findings: [] }),
        "utf-8"
      );
      const agg = await aggregateReviews("W-01", { targetDir: tmp, panelIds: ["ompimpa-ironlaw"] });
      expect(agg.score.verdict).toBe("REMEDIATE");
      expect(agg.findings.some((f) => f.ruleId.includes("reviewer-no-evidence"))).toBeTrue();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("berkas malformed (bukan array/envelope) → REMEDIATE no-evidence", async () => {
    const { tmp, reviewDir } = await makeReviewFixture();
    try {
      await fs.writeFile(path.join(reviewDir, "W-01-ompimpa-ironlaw.json"), `{"status":"ok"}`, "utf-8");
      const agg = await aggregateReviews("W-01", { targetDir: tmp, panelIds: ["ompimpa-ironlaw"] });
      expect(agg.score.verdict).toBe("REMEDIATE");
      expect(agg.findings.some((f) => f.ruleId.includes("reviewer-no-evidence"))).toBeTrue();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("envelope bertemuan dinilai normal (legacy array tetap kompatibel)", async () => {
    const { tmp, reviewDir } = await makeReviewFixture();
    try {
      await fs.writeFile(
        path.join(reviewDir, "W-01-ompimpa-ironlaw.json"),
        JSON.stringify({
          reviewer: "ompimpa-ironlaw",
          story: "W-01",
          completedAt: "2026-09-08T00:00:00Z",
          findings: [{ severity: "Low", file: "lib/a.ex", line: 1, ruleId: "R1", message: "nit", recommendation: "rapikan", verdict: "low", evidence: "format" }],
        }),
        "utf-8"
      );
      await fs.writeFile(
        path.join(reviewDir, "W-01-ompimpa-security.json"),
        JSON.stringify([{ severity: "Low", file: "lib/a.ex", line: 2, ruleId: "R2", message: "nit2", recommendation: "rapikan" }]),
        "utf-8"
      );
      const agg = await aggregateReviews("W-01", { targetDir: tmp, panelIds: ["ompimpa-ironlaw", "ompimpa-security"] });
      expect(agg.deduped.length).toBe(2);
      expect(agg.score.score).toBe(96);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
