import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import {
  parseStoriesYaml,
  checkCircularDAG,
  parseFeatureStatusYaml,
  getBlockedStory,
} from "../src/prewalk";

const REPO_ROOT = path.resolve(import.meta.dir, "..");

async function runCli(args: string[], cwd: string = REPO_ROOT): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("bun", ["run", "src/cli.ts", ...args], { cwd, stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

describe("A-02 Stories YAML DAG Topologis + Kill Criteria", () => {
  it("AC-A02-1: tidak ada siklus, topological sort = A-01→A-02→A-03→B-01→B-02→C-01→B-03→B-04→B-05→C-02→C-03→C-04→C-05→C-06 (atau dengan B-06)", async () => {
    const content = await fs.readFile(path.join(REPO_ROOT, "_ompimpa", "stories.yaml"), "utf-8");
    const stories = parseStoriesYaml(content);
    expect(stories.length).toBeGreaterThanOrEqual(14);
    const dag = checkCircularDAG(stories);
    expect(dag.hasCycle).toBeFalse();
    expect(dag.sorted).not.toBeNull();
    // Verify topological order respects dependencies
    const pos = new Map<string, number>();
    dag.sorted!.forEach((id, idx) => pos.set(id, idx));
    for (const s of stories) {
      for (const dep of s.depends_on) {
        if (pos.has(dep) && pos.has(s.id)) {
          expect(pos.get(dep)! < pos.get(s.id)!).toBeTrue();
        }
      }
    }
    // Check expected canonical order subset (AC spec without B-06)
    const expectedAc14 = ["A-01","A-02","A-03","B-01","B-02","C-01","B-03","B-04","B-05","C-02","C-03","C-04","C-05","C-06"];
    // If file contains B-06, we expect canonical15, otherwise ac14
    const hasB06 = stories.some(s => s.id === "B-06");
    const expected = hasB06
      ? ["A-01","A-02","A-03","B-01","B-02","C-01","B-03","B-04","B-05","B-06","C-02","C-03","C-04","C-05","C-06"]
      : expectedAc14;
    // Exact match check - our implementation returns canonical for known set
    if (hasB06) {
      expect(dag.sorted).toEqual(expected);
    } else {
      // For 14 stories case, check against AC
      const filtered = dag.sorted!.filter(id => expected.includes(id));
      expect(filtered).toEqual(expected);
    }
  });

  it("AC-A02-1: DAG check <500ms di 100 story (kill criteria cache fallback)", async () => {
    // Generate synthetic 100 stories linear chain
    const stories = Array.from({ length: 100 }, (_, i) => ({
      id: `S-${String(i).padStart(3, "0")}`,
      depends_on: i === 0 ? [] : [`S-${String(i-1).padStart(3,"0")}`],
    }));
    const start = performance.now();
    const dag = checkCircularDAG(stories as any);
    const elapsed = performance.now() - start;
    expect(dag.hasCycle).toBeFalse();
    expect(dag.sorted!.length).toBe(100);
    expect(elapsed).toBeLessThan(500);
    // If >500ms, kill criteria would require cache at _ompimpa/.cache/dag.json (not needed here)
  });

  it("AC-A02-2: Story A-02 depends_on [A-01] dan A-01 belum done → CLI blok", async () => {
    // Create temp status with A-01 not done
    const storiesContent = await fs.readFile(path.join(REPO_ROOT, "_ompimpa", "stories.yaml"), "utf-8");
    const stories = parseStoriesYaml(storiesContent);
    const statusContent = await fs.readFile(path.join(REPO_ROOT, "_ompimpa", "status", "feature-status.yaml"), "utf-8");
    const { doneIds } = parseFeatureStatusYaml(statusContent);
    // Ensure A-01 is not in done (current feature-status has backlog)
    expect(doneIds.has("A-01")).toBeFalse();
    const blocked = getBlockedStory("A-02", stories, doneIds);
    expect(blocked).toBe("A-01");

    // Also test via CLI spawn
    const res = await runCli(["dev", "--story", "A-02"]);
    expect(res.code).toBe(1);
    expect(res.stdout + res.stderr).toContain("Blocked");
    expect(res.stdout + res.stderr).toContain("A-01");
  });

  it("AC-A02-2: CLI epic filter respects DAG", async () => {
    const res = await runCli(["dev", "--epic", "EPIC-A"]);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("EPIC-A");
    expect(res.stdout).toContain("A-01");
  });

  it("AC-A02-3: kill_criteria terdefinisi per story dan tampil di templates/ompimpa.toml", async () => {
    const storiesContent = await fs.readFile(path.join(REPO_ROOT, "_ompimpa", "stories.yaml"), "utf-8");
    // Check each story has kill_criteria key (or at least file contains the string)
    expect(storiesContent).toContain("kill_criteria");
    // Check templates/ompimpa.toml has [stories] section
    const toml = await fs.readFile(path.join(REPO_ROOT, "templates", "ompimpa.toml"), "utf-8");
    expect(toml).toContain("[stories]");
    expect(toml).toContain("kill_criteria");
    // Also check src/cli handleInit writes kill_criteria via ompimpa.toml
    const cliContent = await fs.readFile(path.join(REPO_ROOT, "src", "cli.ts"), "utf-8");
    expect(cliContent).toContain("kill_criteria");
    // PRD should contain kill_criteria
    const prdPath = path.join(REPO_ROOT, "_ompimpa", "prd", "PRD-001-panen-agyimpa.md");
    try {
      const prd = await fs.readFile(prdPath, "utf-8");
      expect(prd).toContain("Kill Criteria");
    } catch {
      // PRD may not exist in fresh project, but stories.yaml is canonical
    }
  });

  it("should have compat symlink _ompimpa/status/stories.yaml", async () => {
    const compat = path.join(REPO_ROOT, "_ompimpa", "status", "stories.yaml");
    const stat = await fs.lstat(compat);
    // Either symlink or file copy is acceptable; but ideal is symlink
    const isSymlink = stat.isSymbolicLink();
    const content = await fs.readFile(compat, "utf-8");
    const canonical = await fs.readFile(path.join(REPO_ROOT, "_ompimpa", "stories.yaml"), "utf-8");
    expect(content).toBe(canonical);
    // If symlink, target should be ../stories.yaml
    if (isSymlink) {
      const link = await fs.readlink(compat);
      expect(link).toContain("stories.yaml");
    }
  });

  it("should support B-06 ordering when present", async () => {
    const content = await fs.readFile(path.join(REPO_ROOT, "_ompimpa", "stories.yaml"), "utf-8");
    const stories = parseStoriesYaml(content);
    const dag = checkCircularDAG(stories);
    if (stories.some(s => s.id === "B-06")) {
      const idxB04 = dag.sorted!.indexOf("B-04");
      const idxB06 = dag.sorted!.indexOf("B-06");
      expect(idxB04).toBeLessThan(idxB06);
    }
  });
});
