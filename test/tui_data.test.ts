import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { StatGatedReader, type KanbanState, type SessionEvent } from "../src/tui/data";

describe("F-01: Stat-Gated State Reader & Active Session Tailer", () => {
  let tempDir: string;
  let ompimpaDir: string;
  let statusDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-tui-test-"));
    ompimpaDir = path.join(tempDir, "_ompimpa");
    statusDir = path.join(ompimpaDir, "status");
    await fs.mkdir(statusDir, { recursive: true });

    // Fixture stories.yaml
    const storiesYaml = `
epics:
  - id: EPIC-TEST
    title: "Test Epic"
    description: "Epic testing"
stories:
  - id: TEST-01
    epic: EPIC-TEST
    title: "First test story"
    tea_tier: "P0"
    priority: "P0"
    depends_on: []
  - id: TEST-02
    epic: EPIC-TEST
    title: "Second test story"
    tea_tier: "P1"
    priority: "P1"
    depends_on: ["TEST-01"]
`;
    await fs.writeFile(path.join(ompimpaDir, "stories.yaml"), storiesYaml, "utf-8");

    // Fixture feature-status.yaml
    const featureStatusYaml = `
stories:
  - id: TEST-01
    title: "First test story"
    status: done
    retries: 0
    epic: EPIC-TEST
  - id: TEST-02
    title: "Second test story"
    status: in-progress
    retries: 1
    epic: EPIC-TEST
`;
    await fs.writeFile(path.join(statusDir, "feature-status.yaml"), featureStatusYaml, "utf-8");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("AC-F01-1: Stat-Gated Kanban State Loading", () => {
    it("memuat struktur KanbanState lengkap berisi daftar story terurut dan metadata", async () => {
      const reader = new StatGatedReader(tempDir);
      const state = await reader.loadKanbanState();

      expect(state).toBeDefined();
      expect(state.stories.length).toBe(2);

      const s1 = state.stories.find((s) => s.id === "TEST-01");
      expect(s1).toBeDefined();
      expect(s1?.status).toBe("done");
      expect(s1?.tea_tier).toBe("P0");
      expect(s1?.retries).toBe(0);

      const s2 = state.stories.find((s) => s.id === "TEST-02");
      expect(s2).toBeDefined();
      expect(s2?.status).toBe("in-progress");
      expect(s2?.tea_tier).toBe("P1");
      expect(s2?.retries).toBe(1);

      expect(state.activeStoryId).toBe("TEST-02");
    });
  });

  describe("AC-F01-2: In-Memory Stat Caching", () => {
    it("mengembalikan cache snapshot memori tanpa I/O baru saat mtime dan size tidak berubah", async () => {
      const reader = new StatGatedReader(tempDir);
      const state1 = await reader.loadKanbanState();
      const state2 = await reader.loadKanbanState();

      // Object identity must be identical when stat signature matches (cache hit)
      expect(state1).toBe(state2);

      // Now mutate feature-status.yaml with updated status and different size
      const updatedFeatureStatus = `
stories:
  - id: TEST-01
    title: "First test story"
    status: done
    retries: 0
    epic: EPIC-TEST
  - id: TEST-02
    title: "Second test story mutated"
    status: done
    retries: 1
    epic: EPIC-TEST
`;
      const targetFile = path.join(statusDir, "feature-status.yaml");
      await fs.writeFile(targetFile, updatedFeatureStatus, "utf-8");
      // Advance mtime deterministically without real timers
      await fs.utimes(targetFile, new Date(2027, 1, 1), new Date(2027, 1, 1));

      const state3 = await reader.loadKanbanState();
      expect(state3).not.toBe(state1);
      const s2Updated = state3.stories.find((s) => s.id === "TEST-02");
      expect(s2Updated?.status).toBe("done");
    });
  });

  describe("AC-F01-3: Line Boundary Guard pada JSONL Tailer", () => {
    it("menahan fragmen parsial tanpa newline dan tidak memicu JSON parse error", async () => {
      const sessionFile = path.join(tempDir, "session.jsonl");
      const reader = new StatGatedReader(tempDir);

      // Write complete line 1
      const line1 = JSON.stringify({
        type: "message",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Starting task" }],
        },
      }) + "\n";
      await fs.writeFile(sessionFile, line1, "utf-8");

      const events1 = await reader.tailSessionEvents(sessionFile);
      expect(events1.length).toBe(1);
      expect(events1[0].type).toBe("text");
      expect(events1[0].content).toContain("Starting task");

      // Write INCOMPLETE line 2 (partial write mid-flight, no trailing newline)
      const partialLine2 = '{"type":"message","message":{"role":"assistant","content":[{"type":"toolCall","name":"bash"';
      await fs.appendFile(sessionFile, partialLine2, "utf-8");

      // Reading now must NOT crash and must return no new events yet
      const events2 = await reader.tailSessionEvents(sessionFile);
      expect(events2.length).toBe(0);

      // Complete line 2 with trailing newline
      const remainderLine2 = ',"arguments":{"command":"mix test"}}]}}\n';
      await fs.appendFile(sessionFile, remainderLine2, "utf-8");

      // Reading now must parse the completed line 2!
      const events3 = await reader.tailSessionEvents(sessionFile);
      expect(events3.length).toBe(1);
      expect(events3[0].type).toBe("tool_call");
      expect(events3[0].toolName).toBe("bash");
      expect(events3[0].toolArgs?.command).toBe("mix test");
    });
  });

  describe("AC-F01-4: Structured Session Event Extraction", () => {
    it("menghasilkan array typed SessionEvent dengan timestamp dan payload yang valid", async () => {
      const sessionFile = path.join(tempDir, "session-structured.jsonl");
      const reader = new StatGatedReader(tempDir);

      const lines = [
        // toolCall
        JSON.stringify({
          type: "message",
          timestamp: "2026-09-09T07:15:00.000Z",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "call_123",
                name: "edit",
                arguments: { input: "[lib/foo.ex#1234]\nPUT 1.=2:\n+new code" },
              },
            ],
          },
        }),
        // toolResult
        JSON.stringify({
          type: "message",
          timestamp: "2026-09-09T07:15:01.000Z",
          message: {
            role: "toolResult",
            toolCallId: "call_123",
            content: [{ type: "text", text: "Success applied edit" }],
          },
        }),
        // thinking block
        JSON.stringify({
          type: "message",
          timestamp: "2026-09-09T07:15:02.000Z",
          message: {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "Periksa kembali aturan 26-pure-code-comments",
              },
            ],
          },
        }),
      ].join("\n") + "\n";

      await fs.writeFile(sessionFile, lines, "utf-8");

      const events = await reader.tailSessionEvents(sessionFile);
      expect(events.length).toBe(3);

      expect(events[0].type).toBe("tool_call");
      expect(events[0].toolName).toBe("edit");
      expect(events[0].toolArgs?.input).toContain("lib/foo.ex");

      expect(events[1].type).toBe("tool_result");
      expect(events[1].content).toContain("Success applied edit");

      expect(events[2].type).toBe("thinking");
      expect(events[2].content).toContain("26-pure-code-comments");
    });
  });

  describe("AC-F01-5: Strict Target Directory Session Scoping", () => {
    it("hanya menemukan berkas sesi milik targetDir dan mengabaikan sesi repo lain", async () => {
      const reader = new StatGatedReader(tempDir);
      // Buat direktori sesi tiruan di tempDir/.omp/agent/sessions
      const localSessions = path.join(tempDir, ".omp/agent/sessions");
      await fs.mkdir(localSessions, { recursive: true });

      const sessionFile = path.join(localSessions, "test-session.jsonl");
      const content = [
        JSON.stringify({ type: "title", title: "Test" }),
        JSON.stringify({ type: "session", id: "sess-1", cwd: tempDir }),
      ].join("\n") + "\n";
      await fs.writeFile(sessionFile, content, "utf-8");

      const latest = await reader.findLatestSessionFile();
      expect(latest).toBe(sessionFile);
    });
  });
});
