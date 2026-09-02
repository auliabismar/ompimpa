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

export interface OmpimpaModelsConfig {
  balairung?: string;
  ideate?: string;
  prd?: string;
  adr?: string;
  ui?: string;
  test?: string;
  dev?: string;
  commit?: string;
  ironlaw?: string;
  security?: string;
  debug?: string;
  doc?: string;
  [key: string]: string | undefined;
}

export interface OmpimpaQualityConfig {
  enable_atdd?: boolean;
  quality_score_floor?: number;
  warnings_as_errors?: boolean;
  max_dev_retries?: number;
  auto_macro_review_in_dev?: boolean;
  auto_triage_and_fix?: boolean;
  review?: {
    enable_spec_review?: boolean;
    enable_tech_review?: boolean;
    parallel_reviewers?: number;
    max_triage_fix_cycles?: number;
  };
  nfr?: {
    target_p95_latency_ms?: number;
  };
  verify?: {
    steps?: string[];
  };
}

export interface OmpimpaConfig {
  project?: {
    name?: string;
    framework?: string;
  };
  locale?: {
    communication_language?: string;
    document_output_language?: string;
  };
  governance?: {
    enable_party_mode?: boolean;
    enable_prd_adr?: boolean;
    artifacts_dir?: string;
  };
  quality?: OmpimpaQualityConfig;
  models?: OmpimpaModelsConfig;
  stacks?: {
    use_ash_framework?: boolean;
    use_oban?: boolean;
    use_tailwind?: boolean;
    liveview?: {
      stream_threshold_rows?: number;
    };
  };
  documentation?: {
    diataxis_format?: boolean;
    output_dir?: string;
  };
  tools?: {
    enable_tidewave?: boolean;
    enable_compound_memory?: boolean;
  };
  resources?: {
    max_concurrency?: number;
    use_git_worktrees?: boolean;
    shared_lsp_server?: boolean;
  };
}

export interface OmpEventBus {
  on(event: "session_start", handler: (event: unknown, ctx: HookContext) => Promise<void> | void): void;
  on(event: "tool_call", handler: (event: ToolCallEvent, ctx: HookContext) => Promise<{ block?: boolean; reason?: string } | undefined> | { block?: boolean; reason?: string } | undefined): void;
  on(event: "tool_result", handler: (event: ToolResultEvent, ctx: HookContext) => Promise<{ content?: unknown[]; details?: unknown } | undefined> | { content?: unknown[]; details?: unknown } | undefined): void;
  on(event: "ttsr_triggered", handler: (event: unknown, ctx: HookContext) => Promise<void> | void): void;
  on(event: "session_stop", handler: (event: StopEvent, ctx: HookContext) => Promise<StopResult | undefined> | StopResult | undefined): void;
}

export type TomlPrimitive = string | number | boolean | string[];
export type TomlMap = { [key: string]: TomlPrimitive | TomlMap };

/**
 * Parser TOML terpadu dan type-safe untuk membaca file `ompimpa.toml`.
 */
export function parseToml(content: string): OmpimpaConfig {
  const result: TomlMap = {};
  let currentSection = "";

  const lines = content.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // Deteksi Header Section: [section] atau [section.subsection]
    const sectionMatch = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Deteksi Key = Value
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let valueStr = line.slice(eqIdx + 1).trim();

    // Hapus inline comment jika tidak di dalam quote
    let inQuotes = false;
    let quoteChar = "";
    let commentIdx = -1;
    for (let i = 0; i < valueStr.length; i++) {
      const char = valueStr[i];
      if ((char === '"' || char === "'") && (!inQuotes || quoteChar === char)) {
        inQuotes = !inQuotes;
        quoteChar = inQuotes ? char : "";
      }
      if (char === "#" && !inQuotes) {
        commentIdx = i;
        break;
      }
    }
    if (commentIdx !== -1) {
      valueStr = valueStr.slice(0, commentIdx).trim();
    }

    let parsedValue: TomlPrimitive = valueStr;
    if (valueStr === "true") parsedValue = true;
    else if (valueStr === "false") parsedValue = false;
    else if (/^-?\d+$/.test(valueStr)) parsedValue = parseInt(valueStr, 10);
    else if (/^-?\d+\.\d+$/.test(valueStr)) parsedValue = parseFloat(valueStr);
    else if (
      (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("'") && valueStr.endsWith("'"))
    ) {
      parsedValue = valueStr.slice(1, -1);
    } else if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
      parsedValue = valueStr
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }

    if (currentSection) {
      const parts = currentSection.split(".");
      let target = result;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const existing = target[part];
        if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
          target[part] = {};
        }
        if (i === parts.length - 1) {
          (target[part] as TomlMap)[key] = parsedValue;
        } else {
          target = target[part] as TomlMap;
        }
      }
    } else {
      result[key] = parsedValue;
    }
  }

  return result as unknown as OmpimpaConfig;
}

/**
 * Membaca ompimpa.toml dari direktori kerja.
 */
export function loadOmpimpaConfig(cwd: string = process.cwd()): OmpimpaConfig {
  const tomlPath = path.join(cwd, "ompimpa.toml");
  try {
    if (fs.existsSync(tomlPath)) {
      const content = fs.readFileSync(tomlPath, "utf-8");
      return parseToml(content);
    }
  } catch {
    // Fallback jika tidak ada atau gagal dibaca
  }
  return {};
}
/**
 * B-01 INV-01: Validasi Review Isolation — runReview DILARANG inline, wajib dispatchIsolatedReview via task isolated:true
 */
export function checkReviewIsolation(code: string): { violation: boolean; reason?: string } {
  const hasDirectPrewalk = /runPrewalkScan\s*\(/.test(code);
  const hasDispatch = /dispatchIsolatedReview\s*\(/.test(code);
  if (hasDirectPrewalk && !hasDispatch) {
    return {
      violation: true,
      reason: "Review must be isolated via task — runReview must call dispatchIsolatedReview via task isolated:true (INV-01)",
    };
  }
  return { violation: false };
}

/**
 * Memvalidasi apakah skor TEA scorecard memenuhi floor di ompimpa.toml.
 */
export function validateScoreFloor(
  score: number,
  config: OmpimpaConfig
): { pass: boolean; reason?: string } {
  const floor = config.quality?.quality_score_floor ?? 90;
  if (score < floor) {
    return {
      pass: false,
      reason: `[OMP-IMPA Quality Gate] Skor pengujian TEA (${score}) berada di bawah batas minimum kelulusan (${floor}). Commit diblokir hingga tes diperbaiki.`,
    };
  }
  return { pass: true };
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
  const cwd = ctx?.cwd || process.cwd();
  const config = loadOmpimpaConfig(cwd);

  // 1. Blokir upaya bypass pre-commit hook (Iron Law #26)
  if (/\bgit\s+commit\b/i.test(command) && /(--no-verify|-n\b)/.test(command)) {
    return {
      block: true,
      reason:
        "[OMP-IMPA] `git commit --no-verify` diblokir oleh Hukum Besi #26. Gerbang mutu Git tidak boleh di-bypass.",
    };
  }

  // 2. Berikan notifikasi jika git commit normal dipanggil & cek ATDD
  if (/\bgit\s+commit\b/i.test(command)) {
    if (config.quality?.enable_atdd) {
      const testDir = path.join(cwd, "test");
      if (fs.existsSync(testDir)) {
        try {
          const testEntries = fs.readdirSync(testDir);
          if (testEntries.length === 0) {
            if (ctx?.hasUI && ctx.ui?.notify) {
              ctx.ui.notify(
                "⚠️ [OMP-IMPA ATDD] `enable_atdd` aktif: Pastikan pengujian Red-Phase (`test/`) sudah disertakan sebelum commit.",
                "warning"
              );
            }
          }
        } catch {
          // ignore
        }
      }
    }

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

  // 4. Tegakkan warnings_as_errors jika mix compile dipanggil tanpa flag ketat
  if (config.quality?.warnings_as_errors && command === "mix compile") {
    if (ctx?.hasUI && ctx.ui?.notify) {
      ctx.ui.notify(
        "🛡️ [OMP-IMPA Quality] `warnings_as_errors` aktif. Disarankan menggunakan `mix compile --warnings-as-errors`.",
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
 * B-04: Tiered-aware — hanya T1+T2 blocking, T3 background
 * B-06: Epic-aware — filter by epic jika diberikan
 */
export function checkDevLoopContinuation(cwd: string = process.cwd(), epicFilter?: string): StopResult | undefined {
  const config = loadOmpimpaConfig(cwd);
  const artifactsDir = config.governance?.artifacts_dir || "_ompimpa";
  const statusYamlPath = path.join(cwd, artifactsDir, "status", "feature-status.yaml");
  const maxRetries = config.quality?.max_dev_retries ?? 3;

  try {
    if (fs.existsSync(statusYamlPath)) {
      const content = fs.readFileSync(statusYamlPath, "utf-8");
      const lines = content.split("\n");

      // B-05 Circuit Breaker 3: cek retries >=3
      for (const line of lines) {
        const retryMatch = line.match(/\bretries:\s*(\d+)/i);
        if (retryMatch) {
          const retries = parseInt(retryMatch[1], 10);
          if (retries >= maxRetries) {
            return {
              continue: false,
              decision: "block",
              reason: `[OMP-IMPA Circuit Breaker] Percobaan perbaikan telah mencapai batas maksimal (${retries}/${maxRetries} retries). Autonomous loop dihentikan untuk eskalasi ke manusia.`,
            };
          }
        }
      }

      // B-06 Epic filter: jika epicFilter diberikan, hanya cek story dengan epic tersebut
      let hasPendingStory = false;
      if (epicFilter) {
        // Parse feature-status.yaml epic-aware
        let currentEpic: string | null = null;
        let currentStatus: string | null = null;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("#")) continue;
          const epicMatch = line.match(/^\s*epic:\s*["']?([A-Za-z0-9_-]+)["']?/);
          if (epicMatch) currentEpic = epicMatch[1];
          const statusMatch = line.match(/^\s*status:\s*["']?([a-zA-Z_-]+)["']?/);
          if (statusMatch) currentStatus = statusMatch[1];
          if (currentEpic && currentStatus && (currentStatus === "ready-for-dev" || currentStatus === "in-progress")) {
            if (currentEpic === epicFilter) {
              hasPendingStory = true;
              break;
            }
          }
          // Reset on new story id
          if (/^\s*-\s*id:\s*/.test(line)) {
            currentEpic = null;
            currentStatus = null;
          }
        }
        // Fallback: if parsing failed, fallback to generic check
        if (!hasPendingStory) {
          // Try generic but filter by epic string existence
          hasPendingStory = lines.some((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("#")) return false;
            return /status:\s*["']?(ready-for-dev|in-progress)["']?/i.test(trimmed) && content.includes(`epic: ${epicFilter}`);
          });
          // Actually need more precise: check if any pending and epic match
          // Simpler: if epicFilter is set but we didn't find precise pending, check generic pending for that epic via regex
          if (hasPendingStory) {
            // Verify pending story actually belongs to epicFilter by scanning blocks
            const blocks = content.split(/-\s*id:/);
            hasPendingStory = blocks.some((block) => {
              return /status:\s*["']?(ready-for-dev|in-progress)["']?/i.test(block) && block.includes(`epic: ${epicFilter}`);
            });
          }
        }
      } else {
        // Default: cek apakah masih ada slice dengan status 'in-progress' atau 'ready-for-dev' (mengabaikan baris komentar)
        hasPendingStory = lines.some((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("#")) return false;
          return /status:\s*["']?(ready-for-dev|in-progress)["']?/i.test(trimmed);
        });
      }

      if (hasPendingStory) {
        const epicInfo = epicFilter ? ` untuk epic ${epicFilter}` : "";
        return {
          continue: true,
          additionalContext:
            `[OMP-IMPA Autonomous Loop] Masih terdapat slice berstatus \`ready-for-dev\` atau \`in-progress\`${epicInfo} di \`${artifactsDir}/status/feature-status.yaml\`. Lanjutkan pengerjaan slice berikutnya hingga seluruh tes hijau.`,
        };
      }
    }
  } catch {
    // Abaikan jika berkas status belum dibuat atau gagal dibaca
  }

  return undefined;
}

/**
 * B-04 Tiered Verification helper — return tiered steps for verification
 */
export function getTieredVerifySteps(cwd: string = process.cwd()): { tier1: string[]; tier2: string[]; tier3: string[] } {
  const config = loadOmpimpaConfig(cwd);
  const qv: any = (config as any).quality?.verify;
  const tier1 = qv?.tier1?.steps || ["compile --warnings-as-errors", "format --check-formatted"];
  const tier2 = qv?.tier2?.steps || ["test --stale"];
  const tier3 = qv?.tier3?.steps || ["test", "credo --strict", "sobelow --strict --format json"];
  return { tier1, tier2, tier3 };
}

/**
 * Factory Hook / Extension OMP Default Export
 */
export default function ompimpaGuard(pi: OmpEventBus) {
  // 1. Inisialisasi Sesi & TUI Status
  pi.on("session_start", async (_event: unknown, ctx: HookContext) => {
    const cwd = ctx?.cwd || process.cwd();
    const config = loadOmpimpaConfig(cwd);
    if (ctx?.hasUI && ctx.ui?.setStatus) {
      const modelStatus = config.models?.commit ? ` (commit:${config.models.commit})` : "";
      ctx.ui.setStatus("ompimpa", `⚡ OMP-IMPA Active${modelStatus}`);
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
