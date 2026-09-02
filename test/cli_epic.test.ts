import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";
import { parseStoriesYaml, checkCircularDAG, getBlockedStory } from "../src/prewalk";

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
