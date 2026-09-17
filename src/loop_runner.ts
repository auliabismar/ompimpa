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
import { canWriteStatus, type CheckpointData } from "./status";
import { loadStoryDetail, partitionTargetFiles, type StoryDetail } from "./story_spec";
import {
  runHarnessSession,
  type HarnessExecutor,
  type HarnessSessionResult,
} from "./harness/omp_adapter";
import { buildDevPrompt, buildReviewPrompt, buildCommitPrompt } from "./harness/prompts";
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
  modelCommit?: string;
  /** Timeout sesi omp -p; bila kosong dibaca dari [harness].session_timeout_ms. */
  sessionTimeoutMs?: number;
  /** Timeout fase lokal (scoped-test re-run, agregasi review); bila kosong dari [harness].phase_timeout_ms. */
  phaseTimeoutMs?: number;
  binary?: string;
}
const DEFAULT_SESSION_TIMEOUT_MS = 600_000;
const DEFAULT_PHASE_TIMEOUT_MS = 60_000;

/** Timeout sesi omp -p dari [harness].session_timeout_ms (default 600000). */
export function resolveSessionTimeoutMs(targetDir: string, override?: number): number {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) return override;
  try {
    const cfg = loadOmpimpaConfig(targetDir);
    const v = cfg.harness?.session_timeout_ms;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  } catch {}
  return DEFAULT_SESSION_TIMEOUT_MS;
}

/** Timeout fase lokal dari [harness].phase_timeout_ms (default 60000). */
export function resolvePhaseTimeoutMs(targetDir: string, override?: number): number {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) return override;
  try {
    const cfg = loadOmpimpaConfig(targetDir);
    const v = cfg.harness?.phase_timeout_ms;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  } catch {}
  return DEFAULT_PHASE_TIMEOUT_MS;
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
  resume?: boolean;
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
function formatCheckpointYaml(cp: CheckpointData): string[] {
  const res: string[] = ["    checkpoint:"];
  if (cp.phase) res.push(`      phase: ${cp.phase}`);
  if (cp.spec) res.push(`      spec: "${cp.spec}"`);
  if (cp.test_files && cp.test_files.length > 0) {
    res.push("      test_files:");
    for (const f of cp.test_files) res.push(`        - "${f}"`);
  }
  if (cp.files_touched && cp.files_touched.length > 0) {
    res.push("      files_touched:");
    for (const f of cp.files_touched) res.push(`        - "${f}"`);
  }
  if (cp.review_artifacts && cp.review_artifacts.length > 0) {
    res.push("      review_artifacts:");
    for (const f of cp.review_artifacts) res.push(`        - "${f}"`);
  }
  if (cp.triage_verdict) {
    res.push("      triage_verdict:");
    if (typeof cp.triage_verdict.score === "number") res.push(`        score: ${cp.triage_verdict.score}`);
    if (cp.triage_verdict.verdict) res.push(`        verdict: ${cp.triage_verdict.verdict}`);
    if (typeof cp.triage_verdict.blockers === "number") res.push(`        blockers: ${cp.triage_verdict.blockers}`);
    if (typeof cp.triage_verdict.warnings === "number") res.push(`        warnings: ${cp.triage_verdict.warnings}`);
    if (cp.triage_verdict.summary) res.push(`        summary: "${cp.triage_verdict.summary.replace(/"/g, '\\"')}"`);
  }
  if (cp.commit) res.push(`      commit: "${cp.commit}"`);
  return res;
}

/**
 * Updates story status and retries in _ompimpa/status/feature-status.yaml deterministically
 * using scoped block replacements and atomic file write-and-rename.
 * Supports ADR-007 paired state machine checkpoints and INV-11 done-git atomicity.
 */
export async function updateFeatureStatus(
  targetDir: string,
  storyId: string,
  newStatus: string,
  newRetries: number = 0,
  force = false,
  checkpoint?: CheckpointData,
  run?: number
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

  // INV-11 (Done-Git Atomicity): Status done requires clean git working tree for story files
  if (canonicalStatus === "done" && !force) {
    try {
      const { story } = await loadStoryDetail(storyId, canonicalDir);
      const { targetFiles, testFiles } = partitionTargetFiles(story, canonicalDir);
      const filesToCheck = [...targetFiles, ...testFiles].filter(Boolean);
      if (filesToCheck.length > 0) {
        const proc = spawn("git", ["status", "--porcelain", "--", ...filesToCheck], { cwd: canonicalDir });
        let out = "";
        proc.stdout?.on("data", (d) => (out += d.toString()));
        await new Promise((r) => proc.on("close", r));
        if (out.trim().length > 0) {
          throw new Error(`INV-11 Violation: Cannot set status 'done' for ${storyId} while working tree is dirty: ${out.trim()}`);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("INV-11 Violation")) {
        throw err;
      }
    }
  }

  const escapedId = escapeRegex(sanitizedId);
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
    let blockLines = lines.slice(blockStart, blockEnd);
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

    // Update or insert run
    const actualRun = run !== undefined ? run : newRetries + 1;
    const runIdx = blockLines.findIndex((l) => /run:\s*\d+/.test(l));
    if (runIdx !== -1) {
      blockLines[runIdx] = blockLines[runIdx].replace(/run:\s*\d+/, `run: ${actualRun}`);
    } else {
      const anchorIdx = blockLines.findIndex((l) => /retries:\s*\d+/.test(l));
      if (anchorIdx !== -1) blockLines.splice(anchorIdx + 1, 0, `    run: ${actualRun}`);
      else blockLines.push(`    run: ${actualRun}`);
    }

    // Update or insert checkpoint if provided
    if (checkpoint) {
      const cpYaml = formatCheckpointYaml(checkpoint);
      const cpStart = blockLines.findIndex((l) => /^\s*checkpoint:/.test(l));
      if (cpStart !== -1) {
        let cpEnd = cpStart + 1;
        while (cpEnd < blockLines.length && /^\s{6,}/.test(blockLines[cpEnd])) {
          cpEnd++;
        }
        blockLines = [...blockLines.slice(0, cpStart), ...cpYaml, ...blockLines.slice(cpEnd)];
      } else {
        blockLines.push(...cpYaml);
      }
    }

    content = [...lines.slice(0, blockStart), ...blockLines, ...lines.slice(blockEnd)].join("\n");
  } else {
    // Append new entry cleanly before Kanban summary
    const actualRun = run !== undefined ? run : newRetries + 1;
    const entryLines = [
      `  - id: ${sanitizedId}`,
      `    title: "${sanitizedId}"`,
      `    status: ${canonicalStatus}`,
      `    retries: ${newRetries}`,
      `    run: ${actualRun}`,
    ];
    if (checkpoint) {
      entryLines.push(...formatCheckpointYaml(checkpoint));
    }
    const entry = entryLines.join("\n") + "\n";
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
  // INVARIANT: timeout dua lapis — sesi omp -p (sessionTimeout, default 10 mnt,
  // menampung fan-out 10 reviewer) vs scoped-test re-run lokal (phaseTimeout).
  const sessionTimeout = resolveSessionTimeoutMs(targetDir, harness.sessionTimeoutMs);
  const phaseTimeout = resolvePhaseTimeoutMs(targetDir, harness.phaseTimeoutMs ?? timeoutMs);
  const runSession = harness.runSession || runHarnessSession;
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
  const verify = await executor(proof.argv[0], proof.argv.slice(1), targetDir, env, phaseTimeout);
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
  // INVARIANT: sesi review (sessionTimeout, 10 mnt, fan-out 10) vs agregasi lokal (phaseTimeout).
  const sessionTimeout = resolveSessionTimeoutMs(targetDir, harness.sessionTimeoutMs);
  const phaseTimeout = resolvePhaseTimeoutMs(targetDir, harness.phaseTimeoutMs ?? timeoutMs);
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
        timeoutMs: sessionTimeout,
        markerFile: markerRel,
      },
      executor
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`Harness review session crashed: ${msg}`);
  }
  if (session.status !== "completed" || !session.marker) {
    // R2: sesi timeout/error TANPA marker — agregasi parsial deterministik atas
    // file yang sudah tertulis (bukti 20-3: 6/7 envelope ada, koordinator tak kembali).
    // File hilang = P1 genuine; verdict tetap gagal eksplisit agar retry dapat remediation.
    const partial = await executor("bun", ["run", cliPath, "review", "--story", storyId], targetDir, env, phaseTimeout);
    return fail(
      `Harness review session ${session.status} (exit ${session.exitCode}): ${session.stderrTail} — agregasi parsial lokal exit ${partial.code}: ${partial.stdout || partial.stderr}`,
      session.stdoutTail
    );
  }
  // Agregasi lokal deterministik TANPA --auto: tidak ada stub, file hilang = P1 genuine.
  return executor("bun", ["run", cliPath, "review", "--story", storyId], targetDir, env, phaseTimeout);
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
  const timeoutMs = resolvePhaseTimeoutMs(targetDir, options.timeoutMs);

  const harnessEnabled = options.harness?.enabled === true;

  // Load current status from feature-status.yaml to support resumability (ADR-007)
  let currentStatus = "backlog";
  if (options.resume !== false) {
    try {
      const statusPath = path.join(targetDir, "_ompimpa", "status", "feature-status.yaml");
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const { statusMap } = parseFeatureStatusYaml(statusContent);
      currentStatus = statusMap.get(storyId) || "backlog";
    } catch {}
  }

  // Determine starting phase based on current checkpoint status
  const skipUntilPhase: Record<string, string> = {
    "ready-for-atdd": "atdd",
    "in-atdd": "atdd",
    "ready-for-dev": "code",
    "in-dev": "code",
    "in-progress": "code",
    "ready-for-patch": "code",
    "remediating": "code",
    "ready-for-review": "review",
    "in-review": "review",
    "ready-for-triage": "triage",
    "in-triage": "triage",
  };

  const startFrom = skipUntilPhase[currentStatus];
  let pastStart = !startFrom;

  const phases: Array<{
    name: string;
    inStatus: string;
    args: string[];
    doneStatus: string;
    harnessRole?: "dev" | "review";
  }> = [
    { name: "story", inStatus: "in-story", args: ["run", cliPath, "story", storyId], doneStatus: "ready-for-atdd" },
    { name: "atdd", inStatus: "in-atdd", args: ["run", cliPath, "atdd", storyId, "--auto"], doneStatus: "ready-for-dev" },
    { name: "code", inStatus: "in-dev", args: ["run", cliPath, "code", storyId], doneStatus: "ready-for-review", harnessRole: "dev" },
    { name: "review", inStatus: "in-review", args: ["run", cliPath, "review", "--story", storyId, "--auto"], doneStatus: "ready-for-triage", harnessRole: "review" },
    { name: "triage", inStatus: "in-triage", args: ["run", cliPath, "triage", storyId, "--strict"], doneStatus: "done" },
  ];

  const phaseRecords: StoryPhaseResult["phases"] = [];
  const phaseEnv = {
    ...process.env,
    ...options.env,
    OMPIMPA_HARNESS: "1",
    OMPIMPA_STORY: storyId,
  };

  for (const phase of phases) {
    if (!pastStart) {
      if (phase.name === startFrom) {
        pastStart = true;
      } else {
        phaseRecords.push({
          phase: phase.name,
          cmd: "resumed",
          args: [],
          exitCode: 0,
          durationMs: 0,
          stdout: `[CHECKPOINT-RESUMED] Phase ${phase.name} skipped; resuming from '${currentStatus}'`,
          stderr: "",
        });
        continue;
      }
    }

    options.onPhaseStart?.(phase.name, storyId);
    if (!options.dryRun && phase.inStatus) {
      try {
        await updateFeatureStatus(targetDir, storyId, phase.inStatus, 0, false, { phase: phase.name });
      } catch {}
    }
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
        const cp: CheckpointData = { phase: phase.name };
        if (phase.name === "story" || phase.name === "atdd") {
          cp.spec = `_ompimpa/specs/SPEC-${storyId}.md`;
        }
        if (phase.name === "triage") {
          cp.triage_verdict = { score: 100, verdict: "PASS" };
        }
        await updateFeatureStatus(targetDir, storyId, phase.doneStatus, 0, false, cp);
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

      if (!options.dryRun) {
        try {
          if (phase.name === "triage") {
            await updateFeatureStatus(targetDir, storyId, "ready-for-patch", 0, false, {
              phase: "triage",
              triage_verdict: {
                score: score || 0,
                verdict: "REMEDIATE",
                summary: (res.stderr || res.stdout).slice(0, 500),
              },
            });
          }
        } catch {}
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
export interface SemanticCommitFallbackInput {
  story: StoryDetail;
  epicId?: string;
  diffStat: string;
  nameStatus: string;
  diffSnippet: string;
}

export function generateSemanticCommitFallback(input: SemanticCommitFallbackInput): {
  commitHeader: string;
  commitBody: string;
} {
  const { story, epicId, diffStat, nameStatus } = input;
  const title = story.title || story.id;
  const titleLower = title.toLowerCase();

  // 1. Parse changed files
  const changedFiles = nameStatus
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/\s+/);
      return { status: parts[0] || "M", path: parts[1] || "" };
    });

  // 2. Determine type
  let type = "feat";
  if (
    changedFiles.length > 0 &&
    changedFiles.every(
      (f) =>
        f.path.includes("test/") ||
        f.path.endsWith("_test.exs") ||
        f.path.endsWith(".test.ts") ||
        f.path.endsWith(".test.js")
    )
  ) {
    type = "test";
  } else if (
    changedFiles.length > 0 &&
    changedFiles.every((f) => f.path.startsWith("docs/") || f.path.endsWith(".md"))
  ) {
    type = "docs";
  } else if (
    titleLower.includes("refactor") ||
    titleLower.includes("penertiban") ||
    titleLower.includes("migrasi")
  ) {
    type = "refactor";
  } else if (
    titleLower.includes("fix") ||
    titleLower.includes("perbaikan") ||
    titleLower.includes("koreksi") ||
    titleLower.includes("bug")
  ) {
    type = "fix";
  } else if (
    titleLower.includes("perf") ||
    titleLower.includes("optimasi") ||
    titleLower.includes("kecepatan")
  ) {
    type = "perf";
  } else if (
    titleLower.includes("test") ||
    titleLower.includes("pengujian") ||
    titleLower.includes("atdd")
  ) {
    type = "test";
  } else if (titleLower.includes("doc") || titleLower.includes("panduan")) {
    type = "docs";
  }

  // 3. Determine scope
  let scope = (story.epic || epicId || "").toLowerCase().replace(/^epic-?/, "");
  const primaryTarget = story.target_files[0] || "";
  const allPaths = changedFiles.map((f) => f.path).concat(primaryTarget).join(" ");
  if (allPaths.includes("/sales/")) scope = "sales";
  else if (allPaths.includes("/finance/")) scope = "finance";
  else if (allPaths.includes("/procurement/")) scope = "procurement";
  else if (allPaths.includes("/admin/")) scope = "admin";
  else if (allPaths.includes("journal_entry") || allPaths.includes("accounting")) scope = "accounting";
  else if (allPaths.includes("/form") || allPaths.includes("form_")) scope = "form";
  else if (allPaths.includes("/components/")) scope = "ui";

  const commitHeader = `${type}(${scope || "app"}): ${title} (${story.id})`;

  // 4. Build rich body
  const bodyBullets: string[] = [];

  if (changedFiles.length > 0) {
    const fileSummary = changedFiles
      .slice(0, 6)
      .map((f) => {
        const action = f.status === "A" ? "tambah" : f.status === "D" ? "hapus" : "ubah";
        return `${action} ${f.path}`;
      })
      .join(", ");
    bodyBullets.push(
      `- Perubahan berkas (${changedFiles.length} file): ${fileSummary}${changedFiles.length > 6 ? " …" : ""}`
    );
  }

  if (story.ac && story.ac.length > 0) {
    const acSummary = story.ac
      .slice(0, 3)
      .map((ac) => `${ac.id}: ${ac.then}`)
      .join("; ");
    bodyBullets.push(`- Kriteria terpenuhi: ${acSummary}`);
  }

  bodyBullets.push(`- Story: ${story.id}`);
  if (epicId || story.epic) bodyBullets.push(`- Epic: ${epicId || story.epic}`);
  bodyBullets.push("- Quality: Triage 100/100 PASS (TEA Architecture)");

  const commitBody = [commitHeader, "", ...bodyBullets].join("\n");
  return { commitHeader, commitBody };
}

export interface CommitStoryOptions {
  harness?: HarnessPhaseConfig;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

/**
 * Automatically creates a conventional semantic commit for a completed story
 * upon 100/100 triage PASS.
 * Uses ompimpa-commit agent (model smol) when harness is enabled, with a rich
 * diff-aware fallback.
 */
export async function commitStoryChanges(
  targetDir: string,
  storyId: string,
  executor: SubprocessExecutor = defaultSubprocessExecutor,
  options: CommitStoryOptions = {}
): Promise<{ success: boolean; commitMessage?: string; error?: string }> {
  // Check if targetDir is inside a git repository (supports worktrees, submodules, root, and subdirectories)
  let isGitRepo = false;
  try {
    const gitCheck = await executor("git", ["rev-parse", "--is-inside-work-tree"], targetDir);
    if (gitCheck.code === 0 && (gitCheck.stdout.trim() === "true" || gitCheck.stdout.trim().length > 0)) {
      isGitRepo = true;
    }
  } catch {}

  if (!isGitRepo) {
    try {
      const gitDir = path.join(targetDir, ".git");
      const stat = await fs.stat(gitDir);
      if (stat.isDirectory() || stat.isFile()) {
        isGitRepo = true;
      }
    } catch {}
  }

  if (!isGitRepo) {
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
  let storyDetail: StoryDetail = {
    id: storyId,
    title: storyId,
    epic: "",
    target_files: [],
    test_files: [],
    ac: [],
    dependencies: [],
  };
  let epicId = "";

  try {
    const { story, epic } = await loadStoryDetail(storyId, targetDir);
    storyDetail = story;
    epicId = story.epic || (epic ? epic.id : "");
  } catch {
    // Fallback if stories.yaml cannot be parsed
  }

  const statRes = await executor("git", ["diff", "--cached", "--stat"], targetDir);
  const diffStat = statRes.stdout.trim();

  const nameStatusRes = await executor("git", ["diff", "--cached", "--name-status"], targetDir);
  const nameStatus = nameStatusRes.stdout.trim();

  const diffFullRes = await executor("git", ["diff", "--cached"], targetDir);
  const maxDiffLen = 6_000;
  const diffSnippet =
    diffFullRes.stdout.length > maxDiffLen
      ? diffFullRes.stdout.slice(0, maxDiffLen) + "\n...[truncated staged diff]"
      : diffFullRes.stdout;

  let commitBody = "";
  let commitHeader = "";

  // 4. Try agent-based semantic commit via harness if enabled
  if (options.harness?.enabled) {
    const markerRel = `_ompimpa/runs/${storyId}-commit.result.json`;
    const prompt = buildCommitPrompt({
      story: storyDetail,
      specRel: `_ompimpa/specs/SPEC-${storyId}.md`,
      targetFiles: storyDetail.target_files,
      diffStat,
      nameStatus,
      diffSnippet,
      markerRel,
    });

    const commitModel = options.harness.modelCommit || "smol";
    const sessionTimeout = resolveSessionTimeoutMs(targetDir, options.harness.sessionTimeoutMs);
    const runSession = options.harness.runSession || runHarnessSession;

    try {
      const session = await runSession(
        {
          role: "commit",
          storyId,
          targetDir,
          prompt,
          model: commitModel,
          binary: options.harness.binary,
          timeoutMs: sessionTimeout,
          markerFile: markerRel,
          env: options.env,
        },
        executor
      );

      if (session.status === "completed" && session.marker?.commitMessage) {
        commitBody = session.marker.commitMessage.trim();
        commitHeader = commitBody.split("\n")[0].trim();
      }
    } catch {
      // Graceful fallback to deterministic commit generator
    }
  }

  // 5. Fallback to smart diff-aware commit generator if agent didn't provide message
  if (!commitBody) {
    const fallback = generateSemanticCommitFallback({
      story: storyDetail,
      epicId,
      diffStat,
      nameStatus,
      diffSnippet,
    });
    commitBody = fallback.commitBody;
    commitHeader = fallback.commitHeader;
  }

  // 6. Execute git commit
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
  const timeoutMs = resolvePhaseTimeoutMs(targetDir, options.timeoutMs);
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
      // Guard against dirty uncommitted changes left behind for this story
      let hasUncommitted = false;
      try {
        const { story } = await loadStoryDetail(storyId, targetDir);
        const { targetFiles, testFiles } = partitionTargetFiles(story, targetDir);
        const filesToCheck = [...targetFiles, ...testFiles].filter(Boolean);
        if (filesToCheck.length > 0) {
          const statusRes = await executor("git", ["status", "--porcelain", "--", ...filesToCheck], targetDir);
          if (statusRes.code === 0 && statusRes.stdout.trim().length > 0) {
            hasUncommitted = true;
          }
        }
      } catch {}

      if (hasUncommitted) {
        console.log(`⚠️ Story ${storyId} berstatus done tetapi memiliki perubahan belum di-commit. Menjalankan auto-commit...`);
        try {
          const commitRes = await commitStoryChanges(targetDir, storyId, executor, {
            harness: options.harness,
            env: options.env,
          });
          if (commitRes.commitMessage) {
            console.log(`📦 [Auto-Commit] ${commitRes.commitMessage}`);
          } else if (!commitRes.success && commitRes.error) {
            return failEpic(
              `Story ${storyId} done but uncommitted changes failed to commit: ${commitRes.error} — resolve git state, then re-run`
            );
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return failEpic(`Story ${storyId} commit crashed: ${msg}`);
        }
      }

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
        doneIds.add(storyId);
        completedStories.push(storyId);

        // Auto-commit semantic changes — kegagalan commit bersifat eksplisit:
        // loop berhenti agar user membereskan git state, bukan menumpuk diam-diam.
        let commitMessage: string | undefined;
        try {
          const commitRes = await commitStoryChanges(targetDir, storyId, executor, {
            harness: options.harness,
            env: options.env,
          });
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

        // Tulis status done SETELAH commit berhasil (INV-11: Done-Git Atomicity)
        await updateFeatureStatus(targetDir, storyId, "done", retries, false, {
          phase: "triage",
          triage_verdict: { score: 100, verdict: "PASS" },
          commit: commitMessage || null,
        });

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
        await updateFeatureStatus(targetDir, storyId, "ready-for-patch", retries, false, {
          phase: "triage",
          triage_verdict: {
            score: phaseResult.score || 0,
            verdict: "REMEDIATE",
            summary: phaseResult.error || "Triage failed, retry needed",
          },
        });

        if (retries >= maxRetries) {
          // Circuit breaker tripped! Explicitly record failed state on disk (DATA-STATE-01, ADV-CIRCUIT-BREAKER-STATE-LEAK)
          await updateFeatureStatus(targetDir, storyId, "failed", retries, true);
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
