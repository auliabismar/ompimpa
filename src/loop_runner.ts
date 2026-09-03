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

export interface StoryRunnerOptions {
  repoRoot?: string;
  targetDir?: string;
  maxRetries?: number; // default 3
  dryRun?: boolean;
  executor?: SubprocessExecutor;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
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
  newRetries: number = 0
): Promise<void> {
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

  // Scoped regex strictly bounded to single story record (DATA-INTEGRITY-01, ADV-RACE-REGEX-CORRUPTION)
  // Matches from "  - id: <storyId>" until the next "  - id:" or EOF
  const storyBlockRegex = new RegExp(
    `(^\\s*-\\s*id:\\s*["']?${escapedId}["']?(?:\\s|$)[\\s\\S]*?)(?=\\n\\s*-\\s*id:|\\n# Kanban|$)`,
    "m"
  );

  const blockMatch = content.match(storyBlockRegex);

  if (blockMatch) {
    let block = blockMatch[1];

    // Update status within this block only
    if (/status:\s*[a-zA-Z_-]+/.test(block)) {
      block = block.replace(/status:\s*[a-zA-Z_-]+/, `status: ${newStatus}`);
    } else {
      block += `\n    status: ${newStatus}`;
    }

    // Update or insert retries within this block only
    if (/retries:\s*\d+/.test(block)) {
      block = block.replace(/retries:\s*\d+/, `retries: ${newRetries}`);
    } else {
      block = block.replace(/(status:\s*[a-zA-Z_-]+)/, `$1\n    retries: ${newRetries}`);
    }

    content = content.replace(storyBlockRegex, block);
  } else {
    // Append new entry cleanly before Kanban summary
    const entry = `  - id: ${sanitizedId}
    title: "${sanitizedId}"
    status: ${newStatus}
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

/**
 * Runs the 5 modular phases of a single story via fresh subprocess calls (anti-rot).
 */
export async function runStoryPhases(
  storyId: string,
  options: StoryRunnerOptions = {}
): Promise<StoryPhaseResult> {
  const targetDir = path.resolve(options.targetDir || options.repoRoot || process.cwd());
  const executor = options.executor || defaultSubprocessExecutor;
  const cliPath = path.join(REPO_ROOT, "src", "cli.ts");
  const timeoutMs = options.timeoutMs ?? 60_000;

  const phases = [
    { name: "story", args: ["run", cliPath, "story", storyId] },
    { name: "code", args: ["run", cliPath, "code", storyId] },
    { name: "review", args: ["run", cliPath, "review", storyId] },
    { name: "triage", args: ["run", cliPath, "triage", storyId, "--strict"] },
  ];

  const phaseRecords: StoryPhaseResult["phases"] = [];

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

    const res = await executor("bun", phase.args, targetDir, options.env, timeoutMs);
    const duration = Date.now() - start;

    phaseRecords.push({
      phase: phase.name,
      cmd: "bun",
      args: phase.args,
      exitCode: res.code,
      durationMs: duration,
      stdout: res.stdout,
      stderr: res.stderr,
    });

    options.onPhaseComplete?.(phase.name, storyId, res.code);

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

  const epicStories = stories.filter((s) => s.epic === options.epicId);
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
      await updateFeatureStatus(targetDir, storyId, "in-progress", retries);

      const phaseResult = await runStoryPhases(storyId, {
        targetDir,
        dryRun: options.dryRun,
        executor,
        env: options.env,
        timeoutMs,
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
