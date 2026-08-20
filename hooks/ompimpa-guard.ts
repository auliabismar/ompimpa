/**
 * OMP-IMPA Unified Runtime Guard Hook & Extension
 *
 * Mengintegrasikan:
 * 1. Tool Interceptor (tool_call): Memblokir bypass `git commit --no-verify` (Iron Law #26)
 *    dan memberikan peringatan scoped-testing saat mendeteksi `mix test` global.
 * 2. Output Compactor (tool_result): Memangkas stacktrace ExUnit yang berlebih (>3000 chars)
 *    untuk menghemat 60-80% token konteks LLM.
 * 3. TTSR Telemetry (ttsr_triggered): Memperbarui status UI footer saat interupsi Rasuna Said aktif.
 * 4. Autonomous Dev Loop (session_stop): Melanjutkan loop pengerjaan story secara otonom
 *    berdasarkan state di `_ompimpa/status/feature-status.yaml`.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ToolCallEvent {
  toolName: string;
  toolCallId?: string;
  input: Record<string, unknown>;
}

export interface ToolResultEvent {
  toolName: string;
  toolCallId?: string;
  input?: Record<string, unknown>;
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  details?: Record<string, unknown>;
  isError?: boolean;
}

export interface HookUIContext {
  notify?: (message: string, type?: "info" | "warning" | "error") => void;
  setStatus?: (key: string, text: string | undefined) => void;
}

export interface HookContext {
  hasUI?: boolean;
  ui?: HookUIContext;
  cwd?: string;
}

export interface StopEvent {
  reason?: string;
}

export interface StopResult {
  continue?: boolean;
  additionalContext?: string;
  decision?: "block" | "allow";
  reason?: string;
}

export interface OmpEventBus {
  on(event: "session_start", handler: (event: unknown, ctx: HookContext) => Promise<void> | void): void;
  on(event: "tool_call", handler: (event: ToolCallEvent, ctx: HookContext) => Promise<{ block?: boolean; reason?: string } | undefined> | { block?: boolean; reason?: string } | undefined): void;
  on(event: "tool_result", handler: (event: ToolResultEvent, ctx: HookContext) => Promise<{ content?: unknown[]; details?: unknown } | undefined> | { content?: unknown[]; details?: unknown } | undefined): void;
  on(event: "ttsr_triggered", handler: (event: unknown, ctx: HookContext) => Promise<void> | void): void;
  on(event: "session_stop", handler: (event: StopEvent, ctx: HookContext) => Promise<StopResult | undefined> | StopResult | undefined): void;
}

/**
 * Logika pemfilteran & validasi perintah bash sebelum dieksekusi (tool_call).
 */
export function handleToolCallGuard(
  event: ToolCallEvent,
  ctx?: HookContext
): { block?: boolean; reason?: string } | undefined {
  if (event.toolName !== "bash") return undefined;

  const command = String(event.input.command || "").trim();

  // 1. Blokir upaya bypass pre-commit hook (Iron Law #26)
  if (/\bgit\s+commit\b/i.test(command) && /(--no-verify|-n\b)/.test(command)) {
    return {
      block: true,
      reason:
        "[OMP-IMPA] `git commit --no-verify` diblokir oleh Hukum Besi #26. Gerbang mutu Git tidak boleh di-bypass.",
    };
  }

  // 2. Berikan notifikasi jika git commit normal dipanggil
  if (/\bgit\s+commit\b/i.test(command)) {
    if (ctx?.hasUI && ctx.ui?.notify) {
      ctx.ui.notify("🛡️ [OMP-IMPA] Menjalankan Fast Pre-Commit Gate (Sub-2-Detik)...", "info");
    }
  }

  // 3. Rekomendasi Scoped Test jika memanggil `mix test` tanpa argumen di tengah koding
  if (command === "mix test" || command === "mix test --stale") {
    if (ctx?.hasUI && ctx.ui?.notify) {
      ctx.ui.notify(
        "💡 [OMP-IMPA Tip] Gunakan scoped test (`mix test path/to/file_test.exs`) untuk siklus koding cepat.",
        "info"
      );
    }
  }

  return undefined;
}

/**
 * Logika pemangkasan output stacktrace ExUnit / mix test yang terlalu besar (tool_result).
 */
export function compactTestOutput(
  content: Array<{ type: string; text?: string; [key: string]: unknown }>
): Array<{ type: string; text?: string; [key: string]: unknown }> {
  return content.map((chunk) => {
    if (chunk.type !== "text" || typeof chunk.text !== "string") return chunk;

    const text = chunk.text;
    const MAX_SAFE_CHARS = 3500;

    // Hanya pangkas jika output sangat panjang dan merupakan kegagalan mix test / stacktrace
    if (text.length > MAX_SAFE_CHARS && (text.includes("1) test") || text.includes("** (ExUnit.AssertionError)"))) {
      const lines = text.split("\n");
      const compactedLines: string[] = [];
      let stacktraceCount = 0;

      for (const line of lines) {
        // Deteksi baris stacktrace internal framework
        const isInternalTrace =
          /^\s+stacktrace:/.test(line) ||
          /^\s+\(elixir \d+\.\d+\.\d+\)/.test(line) ||
          /^\s+\(phoenix \d+\.\d+\.\d+\)/.test(line) ||
          /^\s+\(ecto \d+\.\d+\.\d+\)/.test(line);

        if (isInternalTrace) {
          stacktraceCount++;
          if (stacktraceCount <= 2) {
            compactedLines.push(line);
          } else if (stacktraceCount === 3) {
            compactedLines.push("       ... [internal framework stacktrace truncated by ompimpa-guard]");
          }
        } else {
          stacktraceCount = 0;
          compactedLines.push(line);
        }
      }

      return {
        ...chunk,
        text: compactedLines.join("\n"),
      };
    }

    return chunk;
  });
}

/**
 * Logika pengecekan kelanjutan dev loop otomatis (session_stop).
 */
export function checkDevLoopContinuation(cwd: string = process.cwd()): StopResult | undefined {
  const statusYamlPath = path.join(cwd, "_ompimpa", "status", "feature-status.yaml");

  try {
    if (fs.existsSync(statusYamlPath)) {
      const content = fs.readFileSync(statusYamlPath, "utf-8");

      // Cek apakah masih ada slice dengan status 'in-progress' atau 'ready-for-dev'
      const hasPendingStory =
        /status:\s*["']?(ready-for-dev|in-progress)["']?/i.test(content);

      if (hasPendingStory) {
        return {
          continue: true,
          additionalContext:
            "[OMP-IMPA Autonomous Loop] Masih terdapat slice berstatus `ready-for-dev` atau `in-progress` di `_ompimpa/status/feature-status.yaml`. Lanjutkan pengerjaan slice berikutnya hingga seluruh tes hijau.",
        };
      }
    }
  } catch {
    // Abaikan jika berkas status belum dibuat atau gagal dibaca
  }

  return undefined;
}

/**
 * Factory Hook / Extension OMP Default Export
 */
export default function ompimpaGuard(pi: OmpEventBus) {
  // 1. Inisialisasi Sesi & TUI Status
  pi.on("session_start", async (_event: unknown, ctx: HookContext) => {
    if (ctx?.hasUI && ctx.ui?.setStatus) {
      ctx.ui.setStatus("ompimpa", "⚡ OMP-IMPA Active");
    }
  });

  // 2. Pre-Tool Execution Interception (tool_call)
  pi.on("tool_call", async (event: ToolCallEvent, ctx: HookContext) => {
    return handleToolCallGuard(event, ctx);
  });

  // 3. Post-Tool Execution Output Compaction (tool_result)
  pi.on("tool_result", async (event: ToolResultEvent) => {
    if (event.toolName === "bash" && Array.isArray(event.content)) {
      const compacted = compactTestOutput(event.content);
      return { content: compacted };
    }
    return undefined;
  });

  // 4. TTSR Interruption Telemetry (ttsr_triggered)
  pi.on("ttsr_triggered", async (_event: unknown, ctx: HookContext) => {
    if (ctx?.hasUI) {
      if (ctx.ui?.setStatus) {
        ctx.ui.setStatus("ironlaw", "⚠️ Rasuna Said: Interrupted Iron Law");
      }
      if (ctx.ui?.notify) {
        ctx.ui.notify("⚠️ [OMP-IMPA TTSR] Interupsi streaming kode: Pelanggaran Hukum Besi terdeteksi.", "warning");
      }
    }
  });

  // 5. Autonomous Dev Loop Runner (session_stop)
  pi.on("session_stop", async (_event: StopEvent, ctx: HookContext) => {
    const cwd = ctx?.cwd || process.cwd();
    return checkDevLoopContinuation(cwd);
  });
}
