import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  formatSessionEvent,
  renderStreamPane,
  renderTestLogPane,
  type RenderStreamOptions,
} from "../src/tui/panes/stream";
import type { SessionEvent } from "../src/tui/data";
import { stripAnsi, visibleLength } from "../src/tui/terminal";

describe("F-04: Live Event Stream Viewer & Thinking Toggle", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-stream-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const sampleEvents: SessionEvent[] = [
    {
      id: "evt-1",
      timestamp: "2026-09-09T07:10:00.000Z",
      type: "tool_call",
      toolName: "bash",
      toolArgs: { command: "mix test test/live/payment_voucher_live_test.exs" },
      content: '{"command":"mix test test/live/payment_voucher_live_test.exs"}',
    },
    {
      id: "evt-2",
      timestamp: "2026-09-09T07:10:01.000Z",
      type: "tool_call",
      toolName: "edit",
      toolArgs: { input: "[lib/foo.ex#1234]\nPUT 10.=12:\n+code" },
      content: '{"input":"[lib/foo.ex#1234]"}',
    },
    {
      id: "evt-3",
      timestamp: "2026-09-09T07:10:02.000Z",
      type: "tool_call",
      toolName: "read",
      toolArgs: { path: "lib/mimar_web/router.ex:50-100" },
      content: '{"path":"lib/mimar_web/router.ex:50-100"}',
    },
    {
      id: "evt-4",
      timestamp: "2026-09-09T07:10:03.000Z",
      type: "tool_call",
      toolName: "write",
      toolArgs: { path: "test/new_test.exs", content: "defmodule ..." },
      content: '{"path":"test/new_test.exs"}',
    },
    {
      id: "evt-5",
      timestamp: "2026-09-09T07:10:04.000Z",
      type: "thinking",
      content: "Perlu memeriksa apakah socket handle_event memiliki authorize check",
    },
    {
      id: "evt-6",
      timestamp: "2026-09-09T07:10:05.000Z",
      type: "tool_result",
      toolName: "bash",
      content: "Compiling 3 files\nFinished in 0.8 seconds\n5/5 passed",
    },
  ];

  describe("AC-F04-1: Tool Call Badge Formatting (BASH)", () => {
    it("memformat event bash dengan badge ⚡ [BASH] berwarna dan cuplikan perintah", () => {
      const bashEvent = sampleEvents[0];
      const rows = formatSessionEvent(bashEvent, 70);

      expect(rows.length).toBeGreaterThan(0);
      const clean = stripAnsi(rows[0]);
      expect(clean).toContain("⚡ BASH");
      expect(clean).toContain("mix test");
      expect(visibleLength(rows[0])).toBeLessThanOrEqual(70);
    });
  });

  describe("AC-F04-2: File Operation Badges (Edit, Read, Write)", () => {
    it("memformat badge khusus untuk edit, read, dan write dengan benar", () => {
      const editRow = stripAnsi(formatSessionEvent(sampleEvents[1], 70)[0]);
      expect(editRow).toContain("✏️ EDIT");
      expect(editRow).toContain("lib/foo.ex");

      const readRow = stripAnsi(formatSessionEvent(sampleEvents[2], 70)[0]);
      expect(readRow).toContain("📖 READ");
      expect(readRow).toContain("lib/mimar_web/router.ex");

      const writeRow = stripAnsi(formatSessionEvent(sampleEvents[3], 70)[0]);
      expect(writeRow).toContain("📝 WRITE");
      expect(writeRow).toContain("test/new_test.exs");
    });
  });

  describe("AC-F04-3: Thinking / Chain-of-Thought Toggle", () => {
    it("menyembunyikan blok thinking saat showThinking bernilai false", () => {
      const options: RenderStreamOptions = {
        events: sampleEvents,
        tab: "activity",
        showThinking: false,
        targetDir: tempDir,
        width: 70,
        height: 15,
      };

      const lines = renderStreamPane(options);
      const fullText = lines.map((l) => stripAnsi(l)).join("\n");

      expect(fullText).not.toContain("💭 THINK");
      expect(fullText).not.toContain("socket handle_event");
      expect(fullText).toContain("⚡ BASH");
    });

    it("menampilkan blok thinking saat showThinking bernilai true", () => {
      const options: RenderStreamOptions = {
        events: sampleEvents,
        tab: "activity",
        showThinking: true,
        targetDir: tempDir,
        width: 70,
        height: 15,
      };

      const lines = renderStreamPane(options);
      const fullText = lines.map((l) => stripAnsi(l)).join("\n");

      expect(fullText).toContain("💭 THINK");
      expect(fullText).toContain("socket handle_event");
    });
  });

  describe("AC-F04-4: Test Log Tailing Integration", () => {
    it("menampilkan ekor log pengujian terbaru dari tmp/test-logs/", async () => {
      const testLogsDir = path.join(tempDir, "tmp/test-logs");
      await fs.mkdir(testLogsDir, { recursive: true });

      const logContent = `
Running ExUnit with seed: 12345
Compiling 2 files (.ex)
..
Finished in 0.5 seconds
4/4 passed (0 failed)
`;
      await fs.writeFile(path.join(testLogsDir, "mix-test-20260909-071000.log"), logContent, "utf-8");

      const logLines = await renderTestLogPane(tempDir, 70, 10);
      expect(logLines.length).toBeGreaterThan(0);

      const clean = logLines.map((l) => stripAnsi(l)).join("\n");
      expect(clean).toContain("Running ExUnit");
      expect(clean).toContain("4/4 passed");
    });

    it("menampilkan pesan fallback jika direktori tmp/test-logs belum memiliki log", async () => {
      const logLines = await renderTestLogPane(tempDir, 70, 8);
      expect(logLines.length).toBeGreaterThan(0);
      const clean = logLines.map((l) => stripAnsi(l)).join("\n");
      expect(clean).toContain("Belum ada berkas log pengujian");
    });
  });
});
