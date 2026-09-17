import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  commitStoryChanges,
  generateSemanticCommitFallback,
  runEpicLoop,
  type SubprocessExecutor,
} from "../src/loop_runner";
import type { HarnessSessionResult, HarnessSessionSpec } from "../src/harness/omp_adapter";
import { buildCommitPrompt } from "../src/harness/prompts";

describe("Semantic Commit Generator & Agent (ompimpa-commit)", () => {
  it("generateSemanticCommitFallback: mendeteksi type fix/refactor/test/docs dan scope dari diff", () => {
    const resFix = generateSemanticCommitFallback({
      story: {
        id: "T-01",
        title: "Perbaikan bug validasi saldo",
        epic: "epic-finance",
        target_files: ["lib/finance/account.ex"],
        test_files: [],
        ac: [{ id: "AC-1", given: "saldo 0", when: "tarik 100", then: "tolak" }],
        dependencies: [],
      },
      epicId: "epic-finance",
      diffStat: "lib/finance/account.ex | 4 ++--\n1 file changed, 2 insertions(+), 2 deletions(-)",
      nameStatus: "M lib/finance/account.ex",
      diffSnippet: "--- a/lib/finance/account.ex\n+++ b/lib/finance/account.ex",
    });

    expect(resFix.commitHeader).toContain("fix(finance): Perbaikan bug validasi saldo (T-01)");
    expect(resFix.commitBody).toContain("- Perubahan berkas (1 file): ubah lib/finance/account.ex");
    expect(resFix.commitBody).toContain("- Kriteria terpenuhi: AC-1: tolak");
    expect(resFix.commitBody).toContain("- Story: T-01");
    expect(resFix.commitBody).toContain("- Quality: Triage 100/100 PASS (TEA Architecture)");

    const resTest = generateSemanticCommitFallback({
      story: {
        id: "T-02",
        title: "Tambah uji atdd",
        epic: "epic-test",
        target_files: [],
        test_files: ["test/finance_test.exs"],
        ac: [],
        dependencies: [],
      },
      diffStat: "test/finance_test.exs | 10 ++++++++++\n1 file changed, 10 insertions(+)",
      nameStatus: "A test/finance_test.exs",
      diffSnippet: "new file test/finance_test.exs",
    });

    expect(resTest.commitHeader).toContain("test(");
  });

  it("buildCommitPrompt: memuat metadata cerita, diffStat, nameStatus, dan format conventional commit", () => {
    const prompt = buildCommitPrompt({
      story: {
        id: "20-3",
        title: "Top-bar lifecycle FormView",
        epic: "epic-20",
        target_files: ["lib/form_workspace.ex"],
        test_files: ["test/form_workspace_test.exs"],
        ac: [{ id: "AC-203-1", given: "form kotor", when: "navigasi", then: "kunci tombol" }],
        dependencies: [],
      },
      diffStat: "lib/form_workspace.ex | 15 +++++++++++++++\n1 file changed, 15 insertions(+)",
      nameStatus: "M lib/form_workspace.ex",
      diffSnippet: "--- a/lib/form_workspace.ex\n+++ b/lib/form_workspace.ex",
      markerRel: "_ompimpa/runs/20-3-commit.result.json",
    });

    expect(prompt).toContain("ompimpa-commit");
    expect(prompt).toContain("20-3");
    expect(prompt).toContain("Top-bar lifecycle FormView");
    expect(prompt).toContain("lib/form_workspace.ex");
    expect(prompt).toContain("AC-203-1");
    expect(prompt).toContain("_ompimpa/runs/20-3-commit.result.json");
    expect(prompt).toContain("Conventional Commit");
  });

  it("commitStoryChanges: berhasil commit pada Git Worktree di mana .git adalah file, bukan direktori", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-worktree-"));
    // Simulasikan git worktree di mana .git adalah FILE
    await fs.writeFile(path.join(tmp, ".git"), "gitdir: /tmp/fake-gitdir\n", "utf-8");

    const executed: Array<{ cmd: string; args: string[] }> = [];
    const mockExecutor: SubprocessExecutor = async (cmd: string, args: string[]) => {
      executed.push({ cmd, args });
      if (cmd === "git" && args[0] === "rev-parse") {
        return { code: 0, stdout: "true\n", stderr: "" };
      }
      if (cmd === "git" && args[0] === "diff" && args.includes("--quiet")) {
        return { code: 1, stdout: "", stderr: "" }; // Ada staged diff
      }
      if (cmd === "git" && args[0] === "diff" && args.includes("--name-status")) {
        return { code: 0, stdout: "M lib/account.ex\n", stderr: "" };
      }
      if (cmd === "git" && args[0] === "diff" && args.includes("--stat")) {
        return { code: 0, stdout: "lib/account.ex | 2 +-\n1 file changed\n", stderr: "" };
      }
      if (cmd === "git" && args[0] === "diff") {
        return { code: 0, stdout: "diff --git a/lib/account.ex b/lib/account.ex\n", stderr: "" };
      }
      return { code: 0, stdout: "[ok]", stderr: "" };
    };

    try {
      const res = await commitStoryChanges(tmp, "W-01", mockExecutor);
      expect(res.success).toBeTrue();
      expect(res.commitMessage).toBeDefined();
      expect(executed.some((e) => e.cmd === "git" && e.args[0] === "commit")).toBeTrue();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("commitStoryChanges: memanggil harness sesi ompimpa-commit saat harness aktif", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-commitharness-"));
    await fs.mkdir(path.join(tmp, ".git"), { recursive: true });

    let harnessSessionCalled = false;
    const fakeRunSession = async (spec: HarnessSessionSpec): Promise<HarnessSessionResult> => {
      harnessSessionCalled = true;
      expect(spec.role).toBe("commit");
      expect(spec.model).toBe("smol");
      return {
        status: "completed",
        exitCode: 0,
        marker: {
          role: "commit",
          story: "H-01",
          completed: true,
          commitMessage: "feat(auth): implementasi otentikasi token JWT (H-01)\n\n- Tambah modul token guard\n- Story: H-01\n- Quality: Triage 100/100 PASS",
        },
        stdoutTail: "",
        stderrTail: "",
        durationMs: 100,
      };
    };

    const executed: Array<{ cmd: string; args: string[] }> = [];
    const mockExecutor: SubprocessExecutor = async (cmd: string, args: string[]) => {
      executed.push({ cmd, args });
      if (cmd === "git" && args[0] === "diff" && args.includes("--quiet")) {
        return { code: 1, stdout: "", stderr: "" };
      }
      return { code: 0, stdout: "ok", stderr: "" };
    };

    try {
      const res = await commitStoryChanges(tmp, "H-01", mockExecutor, {
        harness: {
          enabled: true,
          modelCommit: "smol",
          runSession: fakeRunSession,
        },
      });

      expect(res.success).toBeTrue();
      expect(harnessSessionCalled).toBeTrue();
      expect(res.commitMessage).toContain("feat(auth): implementasi otentikasi token JWT (H-01)");

      const commitCall = executed.find((e) => e.cmd === "git" && e.args[0] === "commit");
      expect(commitCall).toBeDefined();
      expect(commitCall!.args.some((a) => a.includes("Tambah modul token guard"))).toBeTrue();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("runEpicLoop: melakukan auto-commit jika story berstatus done tetapi ada uncommitted changes", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-doneuncommitted-"));
    await fs.mkdir(path.join(tmp, ".git"), { recursive: true });
    await fs.mkdir(path.join(tmp, "_ompimpa", "status"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "_ompimpa", "stories.yaml"),
      `epics:
  - id: EPIC-X
    title: Epic X
    description: X
stories:
  - id: X-01
    epic: EPIC-X
    title: Story X1
    description: D
    tea_tier: P0
    priority: P0
    depends_on: []
    target_files: ["lib/x.ex"]
    ac:
      - id: AC-X1
        given: g
        when: w
        then: t
`,
      "utf-8"
    );
    // Tandai status X-01 sebagai done
    await fs.writeFile(
      path.join(tmp, "_ompimpa", "status", "feature-status.yaml"),
      `stories:
  - id: X-01
    status: done
    retries: 0
    epic: EPIC-X
`,
      "utf-8"
    );

    const executed: Array<{ cmd: string; args: string[] }> = [];
    const mockExecutor: SubprocessExecutor = async (cmd: string, args: string[]) => {
      executed.push({ cmd, args });
      // Simulasikan git status menunjukkan file lib/x.ex termodifikasi tapi belum di-commit
      if (cmd === "git" && args[0] === "status" && args.includes("--porcelain")) {
        return { code: 0, stdout: " M lib/x.ex\n", stderr: "" };
      }
      if (cmd === "git" && args[0] === "diff" && args.includes("--quiet")) {
        return { code: 1, stdout: "", stderr: "" }; // Ada staged diff
      }
      return { code: 0, stdout: "ok", stderr: "" };
    };

    try {
      const res = await runEpicLoop({
        epicId: "EPIC-X",
        targetDir: tmp,
        executor: mockExecutor,
      });

      expect(res.success).toBeTrue();
      // Verifikasi bahwa git commit dipanggil untuk membereskan perubahan yang tertinggal
      const commitCall = executed.find((e) => e.cmd === "git" && e.args[0] === "commit");
      expect(commitCall).toBeDefined();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
