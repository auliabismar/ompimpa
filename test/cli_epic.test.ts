import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";
import { parseStoriesYaml, checkCircularDAG, getBlockedStory } from "../src/prewalk";
import {
  runEpicLoop,
  runStoryPhases,
  updateFeatureStatus,
  type EpicLoopOptions,
  type EpicLoopResult,
} from "../src/loop_runner";

const REPO_ROOT = path.resolve(import.meta.dir, "..");

async function runCli(args: string[], cwd: string = REPO_ROOT): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cliPath = path.join(REPO_ROOT, "src/cli.ts");
    const proc = spawn("bun", ["run", cliPath, ...args], { cwd, stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

describe("B-06 Epic Orchestrator Flag --epic (Dev per Epic, Review per Story)", () => {
  it("AC-B06-1: stories.yaml epic EPIC-A berisi A-01,A-02,A-03 → dev --epic EPIC-A --auto loop sekuensial A-01→A-02→A-03 tiap story 10 review isolated, bukan 1 diff epic", async () => {
    const content = await fs.readFile(path.join(REPO_ROOT, "_ompimpa", "stories.yaml"), "utf-8");
    const stories = parseStoriesYaml(content);
    const epicA = stories.filter((s) => s.epic === "EPIC-A").map((s) => s.id);
    expect(epicA).toContain("A-01");
    expect(epicA).toContain("A-02");
    expect(epicA).toContain("A-03");
    expect(epicA.length).toBe(3);

    const dag = checkCircularDAG(stories);
    expect(dag.hasCycle).toBeFalse();
    const epicOrder = (dag.sorted || []).filter((id) => epicA.includes(id));
    expect(epicOrder).toEqual(["A-01", "A-02", "A-03"]);

    const res = await runCli(["dev", "--epic", "EPIC-A", "--auto"]);
    expect(res.code).toBe(0);
    const output = res.stdout + res.stderr;
    expect(output).toContain("Epic EPIC-A");
    expect(output).toContain("A-01");
    expect(output).toContain("A-02");
    expect(output).toContain("A-03");
    const idxA01 = output.indexOf("A-01");
    const idxA02 = output.indexOf("A-02");
    const idxA03 = output.indexOf("A-03");
    expect(idxA01).toBeLessThan(idxA02);
    expect(idxA02).toBeLessThan(idxA03);
    expect(output.toLowerCase()).toMatch(/sequential|isolated|review/);
    expect(output).not.toMatch(/1 diff epic|monolit/i);
  });

  it("AC-B06-1: EPIC-B loop sekuensial B-01→B-02→B-03→B-04→B-05→B-06 respects DAG", async () => {
    const content = await fs.readFile(path.join(REPO_ROOT, "_ompimpa", "stories.yaml"), "utf-8");
    const stories = parseStoriesYaml(content);
    const dag = checkCircularDAG(stories);
    const epicBIds = stories.filter((s) => s.epic === "EPIC-B").map((s) => s.id);
    expect(epicBIds).toContain("B-01");
    expect(epicBIds).toContain("B-06");
    const epicOrder = (dag.sorted || []).filter((id) => epicBIds.includes(id));
    const pos = new Map(epicOrder.map((id, i) => [id, i]));
    expect(pos.get("B-01")!).toBeLessThan(pos.get("B-02")!);
    expect(pos.get("B-02")!).toBeLessThan(pos.get("B-05")!);
    expect(pos.get("B-04")!).toBeLessThan(pos.get("B-06")!);

    const res = await runCli(["dev", "--epic", "EPIC-B", "--auto"]);
    expect([0, 1]).toContain(res.code);
    const out = res.stdout + res.stderr;
    expect(out).toContain("Epic EPIC-B");
    expect(out).toContain("B-01");
    if (res.code === 1) {
      expect(out).toContain("Blocked");
      expect(out).toContain("B-01");
    }
  });

  it("AC-B06-2: B-01 REMEDIATE (not done) di epic EPIC-B → B-02 tidak jalan sebelum B-01 PASS 100 (depends_on enforce)", async () => {
    const content = await fs.readFile(path.join(REPO_ROOT, "_ompimpa", "stories.yaml"), "utf-8");
    const stories = parseStoriesYaml(content);
    const doneIds = new Set<string>(["A-01", "A-02", "A-03"]);
    expect(getBlockedStory("B-02", stories, doneIds)).toBe("B-01");
    expect(getBlockedStory("B-01", stories, doneIds)).toBeNull();

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-epic-b06-"));
    const tmpOmpimpa = path.join(tmp, "_ompimpa");
    const tmpStatus = path.join(tmpOmpimpa, "status");
    await fs.mkdir(tmpStatus, { recursive: true });
    await fs.writeFile(path.join(tmpOmpimpa, "stories.yaml"), content, "utf-8");
    const statusContent = `stories:
  - id: A-01
    status: done
    retries: 0
    epic: EPIC-A
  - id: A-02
    status: done
    retries: 0
    epic: EPIC-A
  - id: A-03
    status: done
    retries: 0
    epic: EPIC-A
  - id: B-01
    status: backlog
    retries: 1
    epic: EPIC-B
  - id: B-02
    status: backlog
    retries: 0
    epic: EPIC-B
`;
    await fs.writeFile(path.join(tmpStatus, "feature-status.yaml"), statusContent, "utf-8");
    const resStoryB02 = await runCli(["dev", "--story", "B-02"], tmp);
    expect(resStoryB02.code).toBe(1);
    expect(resStoryB02.stdout + resStoryB02.stderr).toContain("Blocked");
    expect(resStoryB02.stdout + resStoryB02.stderr).toContain("B-01");
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("B-06: CLI epic filter unknown epic → exit 1", async () => {
    const res = await runCli(["dev", "--epic", "EPIC-X"]);
    expect(res.code).toBe(1);
    expect(res.stdout + res.stderr).toContain("not found");
  });

  it("B-06: handleDev epic loop mentions 7→10 isolated reviewers per story, not monolithic", async () => {
    const res = await runCli(["dev", "--epic", "EPIC-A", "--auto"]);
    const out = res.stdout + res.stderr;
    expect(out).toMatch(/isolated|7→10|7->10|per story/i);
  });
});

describe("D-04 Outer CLI Loop Runner (bin/ompimpa dev --epic)", () => {
  it("AC-D04-1 @tea-01: outer while-loop controller executes stories sequentially with fresh process context", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-d04-loop-"));
    const tmpOmpimpa = path.join(tmp, "_ompimpa");
    const tmpStatus = path.join(tmpOmpimpa, "status");
    await fs.mkdir(tmpStatus, { recursive: true });

    const sampleStoriesYaml = `
epics:
  - id: EPIC-TEST
    title: "Test Epic"
    description: "Testing outer loop"
stories:
  - id: T-01
    epic: EPIC-TEST
    title: "Story 1"
    description: "Desc 1"
    tea_tier: "P0"
    priority: "P0"
    depends_on: []
    target_files: ["src/t1.ts"]
    ac:
      - id: AC-T01-1
        given: "given 1"
        when: "when 1"
        then: "then 1"
  - id: T-02
    epic: EPIC-TEST
    title: "Story 2"
    description: "Desc 2"
    tea_tier: "P0"
    priority: "P0"
    depends_on: ["T-01"]
    target_files: ["src/t2.ts"]
    ac:
      - id: AC-T02-1
        given: "given 2"
        when: "when 2"
        then: "then 2"
`;
    await fs.writeFile(path.join(tmpOmpimpa, "stories.yaml"), sampleStoriesYaml, "utf-8");

    const initialStatus = `stories:
  - id: T-01
    status: ready-for-dev
    retries: 0
    epic: EPIC-TEST
  - id: T-02
    status: ready-for-dev
    retries: 0
    epic: EPIC-TEST
`;
    await fs.writeFile(path.join(tmpStatus, "feature-status.yaml"), initialStatus, "utf-8");

    // Track executed subprocesses/commands to verify fresh process context per story
    const executedCalls: Array<{ cmd: string; args: string[]; story?: string; phase?: string }> = [];
    const mockExecutor = async (cmd: string, args: string[], cwd: string) => {
      executedCalls.push({ cmd, args });
      return { code: 0, stdout: `[PID ${Math.floor(Math.random() * 10000)}] phase complete`, stderr: "" };
    };

    const result = await runEpicLoop({
      epicId: "EPIC-TEST",
      auto: true,
      targetDir: tmp,
      executor: mockExecutor,
    });

    expect(result.success).toBeTrue();
    expect(result.epicId).toBe("EPIC-TEST");
    expect(result.totalStories).toBe(2);
    expect(result.completedStories).toEqual(["T-01", "T-02"]);
    expect(result.failedStories).toEqual([]);
    expect(result.executedStories).toEqual(["T-01", "T-02"]);

    // Verify fresh process calls occurred sequentially for each story
    expect(executedCalls.length).toBeGreaterThan(0);

    // Verify feature-status was updated to done for both stories
    const finalStatus = await fs.readFile(path.join(tmpStatus, "feature-status.yaml"), "utf-8");
    expect(finalStatus).toContain("status: done");

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-D04-1 @tea-01: updates feature-status.yaml to done upon 100/100 pass", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-d04-status-"));
    const tmpStatus = path.join(tmp, "_ompimpa", "status");
    await fs.mkdir(tmpStatus, { recursive: true });

    const statusPath = path.join(tmpStatus, "feature-status.yaml");
    const initial = `stories:
  - id: D-04
    title: "Outer CLI Loop Runner"
    status: ready-for-dev
    retries: 0
    epic: EPIC-D
`;
    await fs.writeFile(statusPath, initial, "utf-8");

    await updateFeatureStatus(tmp, "D-04", "done", 0);

    const updated = await fs.readFile(statusPath, "utf-8");
    expect(updated).toContain("status: done");
    expect(updated).toContain("retries: 0");

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-D04-1 @tea-01: circuit breaker stops loop after max retries (max 3) if score < 100", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-d04-cb-"));
    const tmpOmpimpa = path.join(tmp, "_ompimpa");
    const tmpStatus = path.join(tmpOmpimpa, "status");
    await fs.mkdir(tmpStatus, { recursive: true });

    const sampleStoriesYaml = `
epics:
  - id: EPIC-FAIL
    title: "Fail Epic"
stories:
  - id: F-01
    epic: EPIC-FAIL
    title: "Failing Story"
    depends_on: []
    target_files: ["src/fail.ts"]
    ac:
      - id: AC-F01-1
        given: "given"
        when: "when"
        then: "then"
  - id: F-02
    epic: EPIC-FAIL
    title: "Should Not Run"
    depends_on: ["F-01"]
    target_files: ["src/skip.ts"]
    ac:
      - id: AC-F02-1
        given: "given"
        when: "when"
        then: "then"
`;
    await fs.writeFile(path.join(tmpOmpimpa, "stories.yaml"), sampleStoriesYaml, "utf-8");

    const initialStatus = `stories:
  - id: F-01
    status: ready-for-dev
    retries: 0
    epic: EPIC-FAIL
  - id: F-02
    status: ready-for-dev
    retries: 0
    epic: EPIC-FAIL
`;
    await fs.writeFile(path.join(tmpStatus, "feature-status.yaml"), initialStatus, "utf-8");

    // Mock executor that fails triage with exit code 1 (score < 100 / REMEDIATE)
    let triageAttempts = 0;
    const mockFailingExecutor = async (cmd: string, args: string[], cwd: string) => {
      if (args.includes("triage")) {
        triageAttempts++;
        return { code: 1, stdout: "Score: 70/100 — Verdict: 🚫 REMEDIATE", stderr: "P0 violation" };
      }
      return { code: 0, stdout: "ok", stderr: "" };
    };

    const result = await runEpicLoop({
      epicId: "EPIC-FAIL",
      auto: true,
      targetDir: tmp,
      maxRetries: 3,
      executor: mockFailingExecutor,
    });

    expect(result.success).toBeFalse();
    expect(result.failedStories).toContain("F-01");
    expect(result.completedStories).not.toContain("F-01");
    // F-02 should NOT have executed because F-01 failed and tripped circuit breaker
    expect(result.executedStories).not.toContain("F-02");
    expect(triageAttempts).toBe(3);
    expect(result.message).toMatch(/circuit breaker|max retries/i);

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-D04-1 @tea-01: CLI dev --epic <ID> --auto executes via outer loop runner with fresh process context", async () => {
    const res = await runCli(["dev", "--epic", "EPIC-A", "--auto"]);
    expect(res.code).toBe(0);
    const out = res.stdout + res.stderr;
    expect(out).toContain("Epic EPIC-A");
    expect(out).toMatch(/loop runner|outer loop|fresh process context|subprocess/i);
  });
});
