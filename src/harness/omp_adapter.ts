/**
 * OMP Harness Adapter — memanggil sesi agen `omp` nyata dari CLI headless.
 *
 * Model eksekusi (dipinjam dari bmad-loop: fresh agent session per step):
 * CLI tidak pernah menulis kode/temuan review. Ia mem-spawn `omp -p`,
 * menunggu selesai, lalu memverifikasi ARTEFAK DISK + MARKER secara independen.
 * Isi stdout sesi tidak pernah menggerakkan keputusan (hanya ekor debug).
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export type HarnessExecutor = (
  cmd: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  timeoutMs?: number
) => Promise<{ code: number; stdout: string; stderr: string }>;

export type HarnessRole = "dev" | "review";

/**
 * Kontrak penyelesaian sesi. Ditulis OLEH SESI AGEN sebagai aksi terakhir,
 * dibaca + diverifikasi oleh adapter. Tanpa marker valid => sesi dianggap
 * tidak selesai (no-marker), apa pun isi stdout-nya.
 */
export interface HarnessResultMarker {
  role: HarnessRole;
  story: string;
  completed: boolean;
  /** Relatif terhadap targetDir. Wajib untuk review; opsional untuk dev. */
  files?: string[];
  /** Bukti uji dev dalam bentuk argv agar adapter bisa menjalankan ulang. */
  tests?: { argv: string[]; exit: number };
  finishedAt?: string;
}
export interface HarnessSessionSpec {
  role: HarnessRole;
  storyId: string;
  targetDir: string;
  prompt: string;
  /** Relatif terhadap targetDir, mis. `_ompimpa/runs/<story>-dev.result.json`. */
  markerFile: string;
  /** Relatif terhadap targetDir; default `_ompimpa/runs/<story>-<role>.log`. */
  logFile?: string;
  model?: string;
  binary?: string;
  timeoutMs?: number;
  extraArgs?: string[];
  env?: NodeJS.ProcessEnv;
}
export interface HarnessSessionResult {
  status: "completed" | "timeout" | "no-marker" | "error";
  exitCode: number;
  marker: HarnessResultMarker | null;
  stdoutTail: string;
  stderrTail: string;
  durationMs: number;
}

export const HARNESS_TIMEOUT_EXIT_CODE = 124;

export function buildOmpArgv(spec: HarnessSessionSpec): string[] {
  const args: string[] = ["-p", "--mode", "json", "--auto-approve"];
  if (spec.model) args.push("--model", spec.model);
  if (spec.timeoutMs) {
    const minutes = Math.max(1, Math.ceil(spec.timeoutMs / 60000));
    args.push("--max-time", `${minutes}m`);
  }
  if (spec.extraArgs) args.push(...spec.extraArgs);
  args.push(spec.prompt);
  return args;
}

function tail(text: string, max = 2000): string {
  return text.length > max ? text.slice(text.length - max) : text;
}


/**
 * Menjalankan satu sesi harness dan memverifikasi marker penyelesaian.
 * Tidak pernah melempar untuk kegagalan sesi — selalu mengembalikan status.
 */
export async function runHarnessSession(
  spec: HarnessSessionSpec,
  executor: HarnessExecutor
): Promise<HarnessSessionResult> {
  const start = Date.now();
  const binary = spec.binary || "omp";
  const argv = buildOmpArgv(spec);
  const timeoutMs = spec.timeoutMs ?? 600_000;
  const logRel = spec.logFile || `_ompimpa/runs/${spec.storyId}-${spec.role}.log`;
  const persistLog = async (
    result: HarnessSessionResult,
    stdoutFull: string,
    stderrFull: string
  ): Promise<HarnessSessionResult> => {
    try {
      const full = path.isAbsolute(logRel) ? logRel : path.join(spec.targetDir, logRel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      const cap = (text: string, max = 200_000): string =>
        text.length > max ? `[...dipotong, ${text.length} chars...]\n${text.slice(text.length - max)}` : text;
      const header = `# ${spec.role} session ${spec.storyId} — ${new Date().toISOString()} — ${result.status} (exit ${result.exitCode}, ${result.durationMs}ms)\n# cmd: ${binary} ${argv.slice(0, -1).join(" ")} <prompt:${spec.prompt.length}chars>\n`;
      await fs.writeFile(full, `${header}\n--- stdout ---\n${cap(stdoutFull)}\n\n--- stderr ---\n${cap(stderrFull)}\n`, "utf-8");
    } catch {
      // Log best-effort; kegagalan tulis log bukan kegagalan sesi.
    }
    return result;
  };
  let code = 1;
  let stdout = "";
  let stderr = "";
  try {
    const sessionEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...spec.env,
      OMPIMPA_HARNESS: "1",
      OMPIMPA_ROLE: spec.role,
      OMPIMPA_STORY: spec.storyId,
    };
    const res = await executor(binary, argv, spec.targetDir, sessionEnv, timeoutMs);
    code = res.code;
    stdout = res.stdout;
    stderr = res.stderr;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return persistLog({
      status: "error",
      exitCode: 1,
      marker: null,
      stdoutTail: tail(stdout),
      stderrTail: tail(stderr + `\nExecutor error: ${msg}`),
      durationMs: Date.now() - start,
    }, stdout, stderr + `\nExecutor error: ${msg}`);
  }
  const durationMs = Date.now() - start;

  if (code === HARNESS_TIMEOUT_EXIT_CODE || /\[TIMEOUT\]|timed out/i.test(stderr)) {
    return persistLog({ status: "timeout", exitCode: code, marker: null, stdoutTail: tail(stdout), stderrTail: tail(stderr), durationMs }, stdout, stderr);
  }
  if (code !== 0) {
    return persistLog({ status: "error", exitCode: code, marker: null, stdoutTail: tail(stdout), stderrTail: tail(stderr), durationMs }, stdout, stderr);
  }

  // Selesai di level proses — sekarang verifikasi marker di disk.
  try {
    const full = path.isAbsolute(spec.markerFile)
      ? spec.markerFile
      : path.join(spec.targetDir, spec.markerFile);
    const raw = await fs.readFile(full, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    const valid =
      parsed !== null &&
      typeof parsed === "object" &&
      "role" in parsed &&
      "story" in parsed &&
      "completed" in parsed &&
      parsed.role === spec.role &&
      parsed.story === spec.storyId &&
      parsed.completed === true;
    if (valid) {
      const marker: HarnessResultMarker = { role: spec.role, story: spec.storyId, completed: true };
      if ("tests" in parsed) {
        const t: unknown = parsed.tests;
        if (t !== null && typeof t === "object" && "argv" in t && "exit" in t) {
          const argvRaw: unknown = t.argv;
          const exitRaw: unknown = t.exit;
          if (Array.isArray(argvRaw) && typeof exitRaw === "number") {
            const argv = argvRaw.filter((a: unknown): a is string => typeof a === "string");
            if (argv.length === argvRaw.length) marker.tests = { argv, exit: exitRaw };
          }
        }
      }
      if ("files" in parsed) {
        const f: unknown = parsed.files;
        if (Array.isArray(f) && f.every((x: unknown): x is string => typeof x === "string")) marker.files = f;
      }
      return persistLog({ status: "completed", exitCode: code, marker, stdoutTail: tail(stdout), stderrTail: tail(stderr), durationMs }, stdout, stderr);
    }
    return persistLog({
      status: "no-marker",
      exitCode: code,
      marker: null,
      stdoutTail: tail(stdout),
      stderrTail: tail(stderr + `\nMarker invalid: role/story/completed mismatch in ${spec.markerFile}`),
      durationMs,
    }, stdout, stderr);
  } catch {
    return persistLog({
      status: "no-marker",
      exitCode: code,
      marker: null,
      stdoutTail: tail(stdout),
      stderrTail: tail(stderr + `\nMarker missing or unreadable: ${spec.markerFile}`),
      durationMs,
    }, stdout, stderr);
  }
}
