import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import {
  parseStoriesYaml,
  checkCircularDAG,
  parseFeatureStatusYaml,
  getBlockedStory,
  type Story,
} from "./prewalk";
import { canWriteStatus } from "./status";
import { loadStoryDetail, partitionTargetFiles } from "./story_spec";
import {
  runHarnessSession,
  type HarnessExecutor,
  type HarnessSessionResult,
} from "./harness/omp_adapter";
import { buildDevPrompt, buildReviewPrompt } from "./harness/prompts";
import { buildReviewPanel } from "./reviewer";
import { loadOmpimpaConfig } from "../hooks/ompimpa-guard";
import { aggregateReviews } from "./triage";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MAX_STREAM_BUFFER_BYTES = 10 * 1024 * 1024; // 10MB memory guard

// Process registry for orphan prevention (ADV-ZOMBIE-PROCESS-LEAK, SEC-SUBPROC-ORPHAN-LEAK)
const activeChildProcesses = new Set<ChildProcess>();
let signalHandlersRegistered = false;

function registerSignalHandlersOnce(): void {
  if (signalHandlersRegistered) return;
  signalHandlersRegistered = true;

  const handleSignal = (sig: NodeJS.Signals) => {
    for (const child of activeChildProcesses) {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
    // Grace period then exit
    setTimeout(() => {
      for (const child of activeChildProcesses) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
      process.exit(128 + (sig === "SIGINT" ? 2 : 15));
    }, 500);
  };

  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));
}

export type SubprocessExecutor = (
  cmd: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  timeoutMs?: number
) => Promise<{ code: number; stdout: string; stderr: string }>;

export interface StoryPhaseResult {
  storyId: string;
  success: boolean;
  score?: number;
  retries: number;
  phases: Array<{
    phase: string;
    cmd: string;
    args: string[];
    exitCode: number;
    durationMs: number;
    stdout: string;
    stderr: string;
  }>;
  error?: string;
}

export interface HarnessPhaseConfig {
  /** Harness aktif: fase code/review dijalankan sebagai sesi omp nyata. */
  enabled: boolean;
  runSession?: typeof runHarnessSession;
  modelDev?: string;
  modelReview?: string;
  /** Timeout per sesi harness (default 600_000). */
  sessionTimeoutMs?: number;
  binary?: string;
}

export interface StoryRunnerOptions {
  repoRoot?: string;
  targetDir?: string;
  maxRetries?: number; // default 3
  dryRun?: boolean;
  executor?: SubprocessExecutor;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  harness?: HarnessPhaseConfig;
  onPhaseStart?: (phase: string, storyId: string) => void;
  onPhaseComplete?: (phase: string, storyId: string, exitCode: number) => void;
}

export interface EpicLoopOptions {
  epicId: string;
  auto?: boolean;
  targetDir?: string;
  maxRetries?: number; // default 3
  dryRun?: boolean;
  executor?: SubprocessExecutor;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  harness?: HarnessPhaseConfig;
  onStoryStart?: (storyId: string) => void;
  onStoryComplete?: (storyId: string, score: number) => void;
  onStoryFail?: (storyId: string, error: string) => void;
}

export interface EpicLoopHistoryItem {
  storyId: string;
  phases: Array<{ phase: string; exitCode: number; durationMs: number }>;
  score?: number;
  retries: number;
  status: "done" | "blocked" | "failed" | "skipped";
}

export interface EpicLoopResult {
  epicId: string;
  totalStories: number;
  executedStories: string[];
  completedStories: string[];
  failedStories: string[];
  blockedStories: string[];
  success: boolean;
  message: string;
  history: EpicLoopHistoryItem[];
}

export async function defaultSubprocessExecutor(
  cmd: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  timeoutMs: number = 60_000
): Promise<{ code: number; stdout: string; stderr: string }> {
  registerSignalHandlersOnce();

  return new Promise((resolve) => {
    let proc: ChildProcess;
    try {
      proc = spawn(cmd, args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: env || process.env,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return resolve({ code: 1, stdout: "", stderr: `Spawn initialization error: ${msg}` });
    }

    activeChildProcesses.add(proc);
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let settled = false;

    // Timeout guard (ADV-STDIN-PIPE-DEADLOCK, LIFECYCLE-TIMEOUT-01, SEC-SUBPROC-STDIN-DOS)
    const timer = setTimeout(() => {
      if (settled) return;
      try {
        proc.kill("SIGTERM");
        setTimeout(() => {
          try {
            proc.kill("SIGKILL");
          } catch {
            // ignore
          }
        }, 1000);
      } catch {
        // ignore
      }
      settle({
        code: 124,
        stdout,
        stderr: `${stderr}\n[TIMEOUT] Execution timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    const settle = (res: { code: number; stdout: string; stderr: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeChildProcesses.delete(proc);

      // Clean up event listeners to avoid leaks (LIFECYCLE-LEAK-01)
      proc.stdout?.removeAllListeners();
      proc.stderr?.removeAllListeners();
      proc.removeAllListeners();

      try {
        proc.stdout?.destroy();
        proc.stderr?.destroy();
      } catch {
        // ignore
      }

      resolve(res);
    };

    // Buffer chunk collection with memory boundary (MEMORY-HYGIENE-02, SEC-SUBPROC-UNBOUNDED-BUFFER-DOS)
    proc.stdout?.on("data", (data: Buffer | string) => {
      if (stdout.length < MAX_STREAM_BUFFER_BYTES) {
        stdout += data.toString();
      } else if (!stdoutTruncated) {
        stdoutTruncated = true;
        stdout += "\n[OUTPUT TRUNCATED: MAX BUFFER REACHED]";
      }
    });

    proc.stderr?.on("data", (data: Buffer | string) => {
      if (stderr.length < MAX_STREAM_BUFFER_BYTES) {
        stderr += data.toString();
      } else if (!stderrTruncated) {
        stderrTruncated = true;
        stderr += "\n[OUTPUT TRUNCATED: MAX BUFFER REACHED]";
      }
    });

    // Stream error handlers (LIFECYCLE-STREAM-ERROR-01)
    proc.stdout?.on("error", (err) => {
      stderr += `\n[STREAM ERROR stdout] ${err.message}`;
    });
    proc.stderr?.on("error", (err) => {
      stderr += `\n[STREAM ERROR stderr] ${err.message}`;
    });

    // Handle normal and signal-induced termination (ADV-CRASH-SIGNAL-MASKING)
    proc.on("close", (code, signal) => {
      let finalCode = code;
      if (code === null) {
        finalCode = signal ? 128 + 9 : 1;
        stderr += `\n[CRASH] Subprocess terminated by signal: ${signal || "UNKNOWN"}`;
      }
      settle({ code: finalCode ?? 0, stdout, stderr });
    });

    proc.on("error", (err) => {
      settle({ code: 1, stdout, stderr: `${stderr}\nSpawn error: ${err.message}` });
    });
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Updates story status and retries in _ompimpa/status/feature-status.yaml deterministically
 * using scoped block replacements and atomic file write-and-rename.
 */
export async function updateFeatureStatus(
  targetDir: string,
  storyId: string,
  newStatus: string,
  newRetries: number = 0,
  force = false
): Promise<void> {
  const canonicalStatus = newStatus.trim().toLowerCase().replace(/_/g, "-");
  const canonicalDir = path.resolve(targetDir);
  const statusPath = path.join(canonicalDir, "_ompimpa", "status", "feature-status.yaml");
  let content = "";
  try {
    content = await fs.readFile(statusPath, "utf-8");
  } catch {
    await fs.mkdir(path.dirname(statusPath), { recursive: true });
    content = "stories:\n";
  }

  const sanitizedId = storyId.replace(/[^A-Za-z0-9_-]/g, "");
  if (!sanitizedId) {
    throw new Error(`Invalid story identifier: ${storyId}`);
  }
  const escapedId = escapeRegex(sanitizedId);
  // Pencari blok berbasis pindaian baris (deterministik): blok story = dari
  // baris "- id: <storyId>" hingga (eksklusif) baris "- id:" berikutnya,
  // "# Kanban", atau EOF. (Regresi: lookahead `$` + flag `m` lama berhenti
  // di akhir baris pertama sehingga baris status tak tercakup → duplikat.)
  const lines = content.split("\n");
  const idPattern = new RegExp(`^\\s*-\\s*id:\\s*["']?${escapedId}["']?\\s*$`);
  const boundaryPattern = /^\s*-\s*id:\s*["']?[A-Za-z0-9_-]+["']?\s*$|^# Kanban/;
  let blockStart = -1;
  let blockEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (idPattern.test(lines[i])) {
      blockStart = i;
      blockEnd = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (boundaryPattern.test(lines[j])) {
          blockEnd = j;
          break;
        }
      }
      break;
    }
  }

  if (blockStart !== -1) {
    const blockLines = lines.slice(blockStart, blockEnd);
    const statusIdx = blockLines.findIndex((l) => /status:\s*[a-zA-Z_-]+/.test(l));
    if (statusIdx !== -1) {
      const curMatch = blockLines[statusIdx].match(/status:\s*([a-zA-Z_-]+)/);
      const cur = curMatch ? curMatch[1] : "";
      if (!force && !canWriteStatus(cur, canonicalStatus)) return;
      blockLines[statusIdx] = blockLines[statusIdx].replace(/status:\s*[a-zA-Z_-]+/, `status: ${canonicalStatus}`);
    } else {
      blockLines.push(`    status: ${canonicalStatus}`);
    }

    // Update or insert retries within this block only
    const retriesIdx = blockLines.findIndex((l) => /retries:\s*\d+/.test(l));
    if (retriesIdx !== -1) {
      blockLines[retriesIdx] = blockLines[retriesIdx].replace(/retries:\s*\d+/, `retries: ${newRetries}`);
    } else {
      const anchorIdx = blockLines.findIndex((l) => /status:\s*[a-zA-Z_-]+/.test(l));
      if (anchorIdx !== -1) blockLines.splice(anchorIdx + 1, 0, `    retries: ${newRetries}`);
      else blockLines.push(`    retries: ${newRetries}`);
    }

    content = [...lines.slice(0, blockStart), ...blockLines, ...lines.slice(blockEnd)].join("\n");
  } else {
    // Append new entry cleanly before Kanban summary
    const entry = `  - id: ${sanitizedId}
    title: "${sanitizedId}"
    status: ${canonicalStatus}
    retries: ${newRetries}
`;
    const kanbanIdx = content.lastIndexOf("# Kanban");
    if (kanbanIdx >= 0) {
      content = content.slice(0, kanbanIdx).trimEnd() + "\n" + entry + "\n" + content.slice(kanbanIdx);
    } else {
      content = content.trimEnd() + "\n" + entry;
    }
  }

  // Atomic file persistence: write to temp file then rename (DATA-PERSIST-01)
  const tmpPath = `${statusPath}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, statusPath);
}

function scopedTestCommand(testFile: string): string {
  if (testFile.endsWith(".exs")) return `mix test ${testFile} --include atdd`;
  if (testFile.endsWith(".test.ts") || testFile.endsWith(".test.js")) return `bun test ${testFile}`;
  return `mix test ${testFile}`;
}

/**
 * Fase code via sesi harness DEV nyata + verifikasi independen.
 * Sesi menulis kode; adapter menjalankan ulang bukti uji dari marker.
 */
async function runDevHarnessPhase(
  storyId: string,
  targetDir: string,
  executor: SubprocessExecutor,
  env: NodeJS.ProcessEnv | undefined,
  harness: HarnessPhaseConfig,
  timeoutMs: number
): Promise<{ code: number; stdout: string; stderr: string }> {
  const fail = (stderr: string, stdout = "") => ({ code: 1, stdout, stderr });
  let storyDetail;
  try {
    storyDetail = (await loadStoryDetail(storyId, targetDir)).story;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`Cannot load story detail for ${storyId}: ${msg}`);
  }
  const { targetFiles, testFiles } = partitionTargetFiles(storyDetail, targetDir);
  if (testFiles.length === 0) return fail(`No test files resolved for ${storyId}`);
  const markerRel = `_ompimpa/runs/${storyId}-dev.result.json`;
  let remediationFindings: string[] = [];
  try {
    const agg = await aggregateReviews(storyId, { targetDir });
    if (agg.deduped.length > 0) {
      remediationFindings = agg.deduped.map(
        (f) => `[${f.severity}] ${f.ruleId} at ${f.file || "unknown"}:${f.line || 1}: ${f.message} -> Solusi: ${f.remediation || f.recommendation || ""}`
      );
    }
  } catch {}
  const prompt = buildDevPrompt({
    story: storyDetail,
    specRel: `_ompimpa/specs/SPEC-${storyId}.md`,
    targetFiles,
    testFiles,
    scopedTest: scopedTestCommand(testFiles[0]),
    markerRel,
    remediationFindings,
  });
  const runSession = harness.runSession || runHarnessSession;
  const sessionTimeout = harness.sessionTimeoutMs ?? 600_000;
  let session: HarnessSessionResult;
  try {
    session = await runSession(
      {
        role: "dev",
        storyId,
        targetDir,
        prompt,
        model: harness.modelDev,
        binary: harness.binary,
        timeoutMs: sessionTimeout,
        markerFile: markerRel,
      },
      executor
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`Harness dev session crashed: ${msg}`);
  }
  if (session.status !== "completed" || !session.marker) {
    return fail(
      `Harness dev session ${session.status} (exit ${session.exitCode}): ${session.stderrTail}`,
      session.stdoutTail
    );
  }
  // Verifikasi independen: jalankan ulang bukti uji dari marker.
  const proof = session.marker.tests;
  if (!proof || !Array.isArray(proof.argv) || proof.argv.length === 0) {
    return fail(`Dev marker without test proof (tests.argv): ${markerRel}`, session.stdoutTail);
  }
  if (proof.exit !== 0) {
    return fail(`Dev session reported failing tests (exit ${proof.exit})`, session.stdoutTail);
  }
  const verify = await executor(proof.argv[0], proof.argv.slice(1), targetDir, env, timeoutMs);
  if (verify.code !== 0) {
    return fail(
      `Independent scoped-test re-run failed (exit ${verify.code}): ${verify.stderr || verify.stdout}`,
      session.stdoutTail
    );
  }
  return {
    code: 0,
    stdout: `Harness dev session completed for ${storyId}; scoped proof re-run green: ${proof.argv.join(" ")}`,
    stderr: "",
  };
}

/**
 * Fase review via sesi harness REVIEW nyata + agregasi lokal tanpa stub.
 * JSON ditulis sesi; CLI hanya mengagregasi (tanpa --auto agar tak ada stub).
 */
async function runReviewHarnessPhase(
  storyId: string,
  targetDir: string,
  executor: SubprocessExecutor,
  env: NodeJS.ProcessEnv | undefined,
  harness: HarnessPhaseConfig,
  cliPath: string,
  timeoutMs: number
): Promise<{ code: number; stdout: string; stderr: string }> {
  const fail = (stderr: string, stdout = "") => ({ code: 1, stdout, stderr });
  let storyDetail;
  try {
    storyDetail = (await loadStoryDetail(storyId, targetDir)).story;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`Cannot load story detail for ${storyId}: ${msg}`);
  }
  const { targetFiles, testFiles } = partitionTargetFiles(storyDetail, targetDir);
  const config = loadOmpimpaConfig(targetDir);
  const panelIds = buildReviewPanel(config).map((m) => m.id);
  const markerRel = `_ompimpa/review/${storyId}.review.result.json`;
  const prompt = buildReviewPrompt({
    story: storyDetail,
    specRel: `_ompimpa/specs/SPEC-${storyId}.md`,
    targetFiles,
    testFiles,
    reviewDirRel: "_ompimpa/review",
    reviewerIds: panelIds,
    markerRel,
  });
  const runSession = harness.runSession || runHarnessSession;
  let session: HarnessSessionResult;
  try {
    session = await runSession(
      {
        role: "review",
        storyId,
        targetDir,
        prompt,
        model: harness.modelReview,
        binary: harness.binary,
        timeoutMs: harness.sessionTimeoutMs ?? 600_000,
        markerFile: markerRel,
      },
      executor
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`Harness review session crashed: ${msg}`);
  }
  if (session.status !== "completed" || !session.marker) {
    return fail(
      `Harness review session ${session.status} (exit ${session.exitCode}): ${session.stderrTail}`,
      session.stdoutTail
    );
  }
  // Agregasi lokal deterministik TANPA --auto: tidak ada stub, file hilang = P1 genuine.
  return executor("bun", ["run", cliPath, "review", "--story", storyId], targetDir, env, timeoutMs);
}

/**
 * Runs the 5 modular phases of a single story via fresh subprocess calls (anti-rot).
 * Dengan harness aktif, fase code/review dijalankan sebagai sesi omp nyata.
 */
export async function runStoryPhases(
  storyId: string,
  options: StoryRunnerOptions = {}
): Promise<StoryPhaseResult> {
  const targetDir = path.resolve(options.targetDir || options.repoRoot || process.cwd());
  const executor = options.executor || defaultSubprocessExecutor;
  const cliPath = path.join(REPO_ROOT, "src", "cli.ts");
  const timeoutMs = options.timeoutMs ?? 60_000;

  const harnessEnabled = options.harness?.enabled === true;
  const phases: Array<{
    name: string;
    args: string[];
    doneStatus: string;
    harnessRole?: "dev" | "review";
  }> = [
    { name: "story", args: ["run", cliPath, "story", storyId], doneStatus: "ready-for-atdd" },
    { name: "atdd", args: ["run", cliPath, "atdd", storyId, "--auto"], doneStatus: "ready-for-dev" },
    { name: "code", args: ["run", cliPath, "code", storyId], doneStatus: "in-progress", harnessRole: "dev" },
    { name: "review", args: ["run", cliPath, "review", "--story", storyId, "--auto"], doneStatus: "in-review", harnessRole: "review" },
    { name: "triage", args: ["run", cliPath, "triage", storyId, "--strict"], doneStatus: "done" },
  ];

  const phaseRecords: StoryPhaseResult["phases"] = [];
  const phaseEnv = {
    ...process.env,
    ...options.env,
    OMPIMPA_HARNESS: "1",
    OMPIMPA_STORY: storyId,
  };

  for (const phase of phases) {
    options.onPhaseStart?.(phase.name, storyId);
    const start = Date.now();

    if (options.dryRun) {
      phaseRecords.push({
        phase: phase.name,
        cmd: "bun",
        args: phase.args,
        exitCode: 0,
        durationMs: 1,
        stdout: `[DRY-RUN] Executed phase ${phase.name} for story ${storyId}`,
        stderr: "",
      });
      options.onPhaseComplete?.(phase.name, storyId, 0);
      continue;
    }

    let res: { code: number; stdout: string; stderr: string };
    let cmd = "bun";
    let args = phase.args;
    if (harnessEnabled && phase.harnessRole && options.harness) {
      cmd = "omp";
      if (phase.harnessRole === "dev") {
        const hr = await runDevHarnessPhase(storyId, targetDir, executor, phaseEnv, options.harness, timeoutMs);
        res = hr;
        args = ["-p", `dev session for ${storyId}`];
      } else {
        const hr = await runReviewHarnessPhase(storyId, targetDir, executor, phaseEnv, options.harness, cliPath, timeoutMs);
        res = hr;
        args = ["-p", `review session for ${storyId}`];
      }
    } else {
      res = await executor("bun", phase.args, targetDir, phaseEnv, timeoutMs);
    }
    const duration = Date.now() - start;

    phaseRecords.push({
      phase: phase.name,
      cmd,
      args,
      exitCode: res.code,
      durationMs: duration,
      stdout: res.stdout,
      stderr: res.stderr,
    });

    options.onPhaseComplete?.(phase.name, storyId, res.code);
    if (res.code === 0 && !options.dryRun && phase.doneStatus) {
      try {
        await updateFeatureStatus(targetDir, storyId, phase.doneStatus, 0);
      } catch {
        // Status advance best-effort: kegagalan tulis status tidak menggagalkan fase.
      }
    }

    if (res.code !== 0) {
      let score: number | undefined;
      const scoreMatch = (res.stdout + res.stderr).match(/Score:\s*(\d+)\/100/i);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1], 10);
      }

      return {
        storyId,
        success: false,
        score,
        retries: 0,
        phases: phaseRecords,
        error: `Phase ${phase.name} failed with exit code ${res.code}: ${res.stderr || res.stdout}`,
      };
    }
  }

  return {
    storyId,
    success: true,
    score: 100,
    retries: 0,
    phases: phaseRecords,
  };
}
/**
 * Automatically creates a conventional semantic commit for a completed story
 * upon 100/100 triage PASS.
 */
export async function commitStoryChanges(
  targetDir: string,
  storyId: string,
  executor: SubprocessExecutor = defaultSubprocessExecutor
): Promise<{ success: boolean; commitMessage?: string; error?: string }> {
  // Check if .git directory exists
  try {
    const gitDir = path.join(targetDir, ".git");
    const stat = await fs.stat(gitDir);
    if (!stat.isDirectory()) return { success: true };
  } catch {
    return { success: true }; // Not a git repository
  }
  // 0. Format Elixir code before staging if mix.exs exists (pre-commit requirement)
  try {
    const mixPath = path.join(targetDir, "mix.exs");
    const stat = await fs.stat(mixPath);
    if (stat.isFile()) {
      await executor("mix", ["format"], targetDir);
    }
  } catch {}

  // 1. Stage all changes
  const addRes = await executor("git", ["add", "-A"], targetDir);
  if (addRes.code !== 0) {
    return { success: false, error: `git add failed: ${addRes.stderr || addRes.stdout}` };
  }

  // 2. Check if there are any staged changes
  const diffCheck = await executor("git", ["diff", "--cached", "--quiet"], targetDir);
  if (diffCheck.code === 0) {
    // No changes staged to commit
    return { success: true };
  }

  // 3. Load story detail to construct Semantic Commit message
  let type = "feat";
  let scope = "app";
  let title = storyId;
  let epicId = "";

  try {
    const { story, epic } = await loadStoryDetail(storyId, targetDir);
    title = story.title;
    epicId = story.epic || (epic ? epic.id : "");

    const titleLower = story.title.toLowerCase();
    if (titleLower.includes("refactor") || titleLower.includes("penertiban") || titleLower.includes("migrasi")) {
      type = "refactor";
    } else if (titleLower.includes("fix") || titleLower.includes("perbaikan") || titleLower.includes("koreksi")) {
      type = "fix";
    } else if (titleLower.includes("test") || titleLower.includes("pengujian") || titleLower.includes("atdd")) {
      type = "test";
    } else if (titleLower.includes("doc") || titleLower.includes("panduan")) {
      type = "docs";
    }

    // Determine scope
    scope = (story.epic || "").toLowerCase().replace(/^epic-?/, "");
    const primaryTarget = story.target_files[0] || "";
    if (primaryTarget.includes("/sales/")) scope = "sales";
    else if (primaryTarget.includes("/finance/")) scope = "finance";
    else if (primaryTarget.includes("/procurement/")) scope = "procurement";
    else if (primaryTarget.includes("/admin/")) scope = "admin";
    else if (primaryTarget.includes("journal_entry") || primaryTarget.includes("accounting")) scope = "accounting";
    else if (primaryTarget.includes("/components/")) scope = "ui";
  } catch {
    // Fallback if stories.yaml cannot be parsed
  }

  const commitHeader = `${type}(${scope || "app"}): ${title} (${storyId})`;
  const commitBody = [
    commitHeader,
    "",
    `- Story: ${storyId}`,
    epicId ? `- Epic: ${epicId}` : null,
    "- Quality: Triage 100/100 PASS (TEA Architecture)",
  ]
    .filter(Boolean)
    .join("\n");

  // 4. Execute git commit
  const commitRes = await executor("git", ["commit", "-m", commitBody], targetDir);
  if (commitRes.code !== 0) {
    return {
      success: false,
      error: `git commit failed (exit code ${commitRes.code}): ${commitRes.stderr || commitRes.stdout}`,
    };
  }

  return { success: true, commitMessage: commitHeader };
}

/**
 * Mencatat jejak run ke SPEC story (ledger append-only §12).
 * SPEC adalah living record: intent beku tidak tersentuh, hasil run terakumulasi.
 * Best-effort: SPEC hilang bukan kegagalan loop.
 */
export async function appendSpecLedger(
  targetDir: string,
  storyId: string,
  lines: string[]
): Promise<void> {
  try {
    const specPath = path.join(targetDir, "_ompimpa", "specs", `SPEC-${storyId}.md`);
    const existing = await fs.readFile(specPath, "utf-8");
    const stamp = new Date().toISOString();
    const bullets = lines.map((l) => `- [${stamp}] ${l}`).join("\n");
    const header = "## 12. Run Ledger (Append-Only Selama Loop)";
    const next = existing.includes(header)
      ? `${existing.trimEnd()}\n${bullets}\n`
      : `${existing.trimEnd()}\n\n---\n\n${header}\n\n_Berisi jejak eksekusi loop per run; dilarang menghapus._\n\n${bullets}\n`;
    await fs.writeFile(specPath, next, "utf-8");
  } catch {
    // SPEC belum ada (mis. fixture test) — ledger di-skip tanpa menggagalkan loop.
  }
}

/**
 * Outer while-loop controller executing stories sequentially within an Epic
 * via clean subprocesses with fresh process context (anti-rot).
 */
export async function runEpicLoop(options: EpicLoopOptions): Promise<EpicLoopResult> {
  const targetDir = path.resolve(options.targetDir || process.cwd());
  const maxRetries = options.maxRetries ?? 3;
  const executor = options.executor || defaultSubprocessExecutor;
  const timeoutMs = options.timeoutMs ?? 60_000;

  // Verify target directory exists (SEC-PATH-TRAVERSAL-BOUNDARY)
  try {
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      return {
        epicId: options.epicId,
        totalStories: 0,
        executedStories: [],
        completedStories: [],
        failedStories: [],
        blockedStories: [],
        success: false,
        message: `Target directory is not a directory: ${targetDir}`,
        history: [],
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      epicId: options.epicId,
      totalStories: 0,
      executedStories: [],
      completedStories: [],
      failedStories: [],
      blockedStories: [],
      success: false,
      message: `Cannot access target directory ${targetDir}: ${msg}`,
      history: [],
    };
  }

  // 1. Read and parse stories.yaml DAG
  const storiesYamlPath = path.join(targetDir, "_ompimpa", "stories.yaml");
  const fallbackStoriesPath = path.join(targetDir, "_ompimpa", "status", "stories.yaml");
  let storiesContent: string | null = null;

  try {
    storiesContent = await fs.readFile(storiesYamlPath, "utf-8");
  } catch {
    try {
      storiesContent = await fs.readFile(fallbackStoriesPath, "utf-8");
    } catch {
      return {
        epicId: options.epicId,
        totalStories: 0,
        executedStories: [],
        completedStories: [],
        failedStories: [],
        blockedStories: [],
        success: false,
        message: `stories.yaml not found in ${targetDir}`,
        history: [],
      };
    }
  }

  const stories = parseStoriesYaml(storiesContent!);
  const dag = checkCircularDAG(stories);
  if (dag.hasCycle) {
    return {
      epicId: options.epicId,
      totalStories: 0,
      executedStories: [],
      completedStories: [],
      failedStories: [],
      blockedStories: [],
      success: false,
      message: `Circular DAG dependency detected: ${dag.cyclePath?.join(" -> ")}`,
      history: [],
    };
  }

  const epicStories = stories.filter(
    (s) => s.epic === options.epicId || s.epic?.toLowerCase() === options.epicId?.toLowerCase()
  );
  if (epicStories.length === 0) {
    return {
      epicId: options.epicId,
      totalStories: 0,
      executedStories: [],
      completedStories: [],
      failedStories: [],
      blockedStories: [],
      success: false,
      message: `Epic ${options.epicId} not found`,
      history: [],
    };
  }

  // Topological ordering of stories for this epic
  const globalOrder = dag.sorted || [];
  const epicOrder = globalOrder.filter((id) => epicStories.some((s) => s.id === id));

  // 2. Load feature-status
  const statusPath = path.join(targetDir, "_ompimpa", "status", "feature-status.yaml");
  let statusContent = "";
  try {
    statusContent = await fs.readFile(statusPath, "utf-8");
  } catch {
    // Assume empty
  }
  const { doneIds, statusMap } = parseFeatureStatusYaml(statusContent);

  const executedStories: string[] = [];
  const completedStories: string[] = [];
  const failedStories: string[] = [];
  const blockedStories: string[] = [];
  const history: EpicLoopHistoryItem[] = [];
  const failEpic = (message: string): EpicLoopResult => ({
    epicId: options.epicId,
    totalStories: epicOrder.length,
    executedStories,
    completedStories,
    failedStories,
    blockedStories,
    success: false,
    message,
    history,
  });

  // 3. Sequential outer while-loop per story
  for (const storyId of epicOrder) {
    const currentStatus = statusMap.get(storyId);

    // Skip if already done
    if (currentStatus === "done" && doneIds.has(storyId)) {
      completedStories.push(storyId);
      history.push({
        storyId,
        phases: [],
        score: 100,
        retries: 0,
        status: "skipped",
      });
      continue;
    }

    // Check if blocked by dependencies
    const blockedBy = getBlockedStory(storyId, stories, doneIds);
    if (blockedBy) {
      blockedStories.push(storyId);
      history.push({
        storyId,
        phases: [],
        retries: 0,
        status: "blocked",
      });
      return {
        epicId: options.epicId,
        totalStories: epicOrder.length,
        executedStories,
        completedStories,
        failedStories,
        blockedStories,
        success: false,
        message: `Blocked: ${storyId} depends on ${blockedBy} not done — stopping epic loop`,
        history,
      };
    }

    // Execute story phases inside retry while-loop
    options.onStoryStart?.(storyId);
    executedStories.push(storyId);

    let retries = 0;
    let storyPassed = false;
    const storyPhaseSummaries: Array<{ phase: string; exitCode: number; durationMs: number }> = [];

    while (retries < maxRetries && !storyPassed) {
      // Engine owns the board: paksa in-progress agar status jujur walau sesi
      // yolo sempat mencoret feature-status.yaml di luar kontrak.
      await updateFeatureStatus(targetDir, storyId, "in-progress", retries, true);

      const phaseResult = await runStoryPhases(storyId, {
        targetDir,
        dryRun: options.dryRun,
        executor,
        env: options.env,
        timeoutMs,
        harness: options.harness,
      });

      for (const p of phaseResult.phases) {
        storyPhaseSummaries.push({
          phase: p.phase,
          exitCode: p.exitCode,
          durationMs: p.durationMs,
        });
      }

      if (phaseResult.success) {
        storyPassed = true;
        await updateFeatureStatus(targetDir, storyId, "done", retries);
        doneIds.add(storyId);
        completedStories.push(storyId);

        // Auto-commit semantic changes — kegagalan commit bersifat eksplisit:
        // loop berhenti agar user membereskan git state, bukan menumpuk diam-diam.
        let commitMessage: string | undefined;
        try {
          const commitRes = await commitStoryChanges(targetDir, storyId, executor);
          if (commitRes.commitMessage) {
            commitMessage = commitRes.commitMessage;
            console.log(`📦 [Auto-Commit] ${commitRes.commitMessage}`);
          } else if (!commitRes.success && commitRes.error) {
            return failEpic(
              `Story ${storyId} done but commit failed: ${commitRes.error} — resolve git state, then re-run`
            );
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return failEpic(`Story ${storyId} done but commit crashed: ${msg} — resolve git state, then re-run`);
        }

        await appendSpecLedger(targetDir, storyId, [
          `done (triage 100/100, retries ${retries})`,
          ...(commitMessage ? [`commit: ${commitMessage}`] : [`commit: skipped (no changes)`]),
        ]);

        options.onStoryComplete?.(storyId, 100);

        history.push({
          storyId,
          phases: storyPhaseSummaries,
          score: 100,
          retries,
          status: "done",
        });
      } else {
        retries++;
        await updateFeatureStatus(targetDir, storyId, "in-progress", retries);

        if (retries >= maxRetries) {
          // Circuit breaker tripped! Explicitly record failed state on disk (DATA-STATE-01, ADV-CIRCUIT-BREAKER-STATE-LEAK)
          await updateFeatureStatus(targetDir, storyId, "failed", retries);
          failedStories.push(storyId);
          options.onStoryFail?.(storyId, phaseResult.error || "Circuit breaker tripped");

          history.push({
            storyId,
            phases: storyPhaseSummaries,
            score: phaseResult.score,
            retries,
            status: "failed",
          });
          await appendSpecLedger(targetDir, storyId, [
            `failed (circuit breaker, retries ${retries}): ${phaseResult.error || "max retries"}`,
          ]);
          return {
            epicId: options.epicId,
            totalStories: epicOrder.length,
            executedStories,
            completedStories,
            failedStories,
            blockedStories,
            success: false,
            message: `Circuit breaker tripped for story ${storyId}: exceeded max retries (${maxRetries})`,
            history,
          };
        }
      }
    }
  }

  return {
    epicId: options.epicId,
    totalStories: epicOrder.length,
    executedStories,
    completedStories,
    failedStories,
    blockedStories,
    success: failedStories.length === 0 && blockedStories.length === 0,
    message: `Epic ${options.epicId} executed successfully: ${completedStories.length}/${epicOrder.length} stories done`,
    history,
  };
}
