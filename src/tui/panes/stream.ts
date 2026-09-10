import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SessionEvent } from "../data";
import { truncateAnsi, padAnsi } from "../terminal";

export type StreamTab = "activity" | "test_logs" | "spec";

export interface RenderStreamOptions {
  events: SessionEvent[];
  tab: StreamTab;
  showThinking: boolean;
  targetDir: string;
  width: number;
  height: number;
  scrollOffset?: number;
}

/**
 * Formats a single session event into one or more rendered visual lines.
 */
export function formatSessionEvent(event: SessionEvent, maxWidth: number): string[] {
  const reset = "\x1b[0m";
  const lines: string[] = [];

  // Extract short time: HH:MM:SS
  let timeStr = "";
  try {
    const d = new Date(event.timestamp);
    timeStr = `\x1b[90m${d.toTimeString().split(" ")[0]}\x1b[0m `;
  } catch {
    timeStr = "\x1b[90m--:--:--\x1b[0m ";
  }

  if (event.type === "tool_call") {
    const tool = event.toolName || "tool";
    let badge = "";
    let detail = "";

    if (tool === "bash") {
      badge = "\x1b[33;1m⚡ BASH\x1b[0m";
      const cmd =
        (event.toolArgs && typeof event.toolArgs.command === "string"
          ? event.toolArgs.command
          : "") || event.content;
      detail = cmd.split("\n")[0];
    } else if (tool === "edit") {
      badge = "\x1b[36;1m✏️ EDIT\x1b[0m";
      const input =
        (event.toolArgs && typeof event.toolArgs.input === "string"
          ? event.toolArgs.input
          : "") || event.content;
      const firstLine = input.split("\n")[0];
      const match = firstLine.match(/\[(.*?)#/);
      detail = match ? match[1] : firstLine;
    } else if (tool === "read") {
      badge = "\x1b[34;1m📖 READ\x1b[0m";
      const p =
        (event.toolArgs && typeof event.toolArgs.path === "string"
          ? event.toolArgs.path
          : "") || event.content;
      detail = p;
    } else if (tool === "write") {
      badge = "\x1b[32;1m📝 WRITE\x1b[0m";
      const p =
        (event.toolArgs && typeof event.toolArgs.path === "string"
          ? event.toolArgs.path
          : "") || event.content;
      detail = p;
    } else {
      badge = `\x1b[35;1m🔧 ${tool.toUpperCase()}\x1b[0m`;
      detail = event.content;
    }

    const row = `${timeStr}${badge} ${detail}`;
    lines.push(truncateAnsi(row, maxWidth));
  } else if (event.type === "thinking") {
    const badge = "\x1b[90;3m💭 THINK:\x1b[0m";
    const snippet = event.content.replace(/\n+/g, " ").trim();
    const row = `${timeStr}${badge} \x1b[90;3m${snippet}${reset}`;
    lines.push(truncateAnsi(row, maxWidth));
  } else if (event.type === "tool_result") {
    const badge = "\x1b[90m↳\x1b[0m";
    const firstLine = event.content.trim().split("\n")[0] || "";
    if (firstLine) {
      const row = `${timeStr}${badge} \x1b[90m${firstLine}${reset}`;
      lines.push(truncateAnsi(row, maxWidth));
    }
  } else if (event.type === "text") {
    const badge = "\x1b[37m💬\x1b[0m";
    const snippet = event.content.replace(/\n+/g, " ").trim();
    const row = `${timeStr}${badge} ${snippet}`;
    lines.push(truncateAnsi(row, maxWidth));
  }

  return lines;
}

/**
 * Tailing and formatting the most recent mix test log from tmp/test-logs/
 */
export async function renderTestLogPane(
  targetDir: string,
  width: number,
  height: number
): Promise<string[]> {
  const testLogsDir = path.join(targetDir, "tmp/test-logs");
  const lines: string[] = [];

  try {
    const dirents = await fs.readdir(testLogsDir, { withFileTypes: true });
    const logFiles: Array<{ name: string; mtime: number }> = [];

    for (const d of dirents) {
      if (d.isFile() && d.name.endsWith(".log")) {
        try {
          const st = await fs.stat(path.join(testLogsDir, d.name));
          logFiles.push({ name: d.name, mtime: st.mtimeMs });
        } catch {
          // ignore
        }
      }
    }

    if (logFiles.length === 0) {
      lines.push(padAnsi("\x1b[90mBelum ada berkas log pengujian di tmp/test-logs/\x1b[0m", width));
    } else {
      logFiles.sort((a, b) => b.mtime - a.mtime);
      const newestLog = path.join(testLogsDir, logFiles[0].name);
      const raw = await fs.readFile(newestLog, "utf-8");
      const rawLines = raw.split("\n");

      // Take last lines fitting height
      const sliceLines = rawLines.slice(Math.max(0, rawLines.length - height));
      for (const line of sliceLines) {
        let highlighted = line;
        if (/passed/i.test(line)) {
          highlighted = `\x1b[32m${line}\x1b[0m`;
        } else if (/failed|failure|error/i.test(line)) {
          highlighted = `\x1b[31;1m${line}\x1b[0m`;
        }
        lines.push(padAnsi(truncateAnsi(highlighted, width), width));
      }
    }
  } catch {
    lines.push(padAnsi("\x1b[90mBelum ada berkas log pengujian (tmp/test-logs/)\x1b[0m", width));
  }

  while (lines.length < height) {
    lines.push(" ".repeat(width));
  }

  return lines;
}

/**
 * Main render function for the right panel supporting multi-tab views.
 */
export function renderStreamPane(options: RenderStreamOptions): string[] {
  const { events, tab, showThinking, width, height } = options;

  if (tab === "test_logs") {
    // Note: async log pane is handled via renderTestLogPane, sync fallback placeholder here
    const placeholder = [
      padAnsi("\x1b[36m[Tab: Test Logs]\x1b[0m Loading...", width),
    ];
    while (placeholder.length < height) {
      placeholder.push(" ".repeat(width));
    }
    return placeholder;
  }

  // Activity stream tab
  const allFormattedRows: string[] = [];

  for (const ev of events) {
    if (ev.type === "thinking" && !showThinking) {
      continue;
    }
    const rows = formatSessionEvent(ev, width);
    allFormattedRows.push(...rows);
  }

  // Auto-scroll to tail
  const visibleRows = allFormattedRows.slice(Math.max(0, allFormattedRows.length - height));

  const result: string[] = [];
  for (const row of visibleRows) {
    result.push(padAnsi(truncateAnsi(row, width), width));
  }

  while (result.length < height) {
    result.push(" ".repeat(width));
  }

  return result;
}
