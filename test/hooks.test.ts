import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import ompimpaGuard, {
  handleToolCallGuard,
  compactTestOutput,
  checkDevLoopContinuation,
  type ToolCallEvent,
  type HookContext,
} from "../hooks/ompimpa-guard";

describe("OMP-IMPA Guard Hook", () => {
  describe("handleToolCallGuard", () => {
    it("should ignore non-bash tool calls", () => {
      const event: ToolCallEvent = {
        toolName: "read",
        input: { path: "lib/foo.ex" },
      };
      const res = handleToolCallGuard(event);
      expect(res).toBeUndefined();
    });

    it("should allow valid git commit commands", () => {
      const event: ToolCallEvent = {
        toolName: "bash",
        input: { command: 'git commit -m "feat: user login"' },
      };
      let notified = false;
      const ctx: HookContext = {
        hasUI: true,
        ui: {
          notify: () => {
            notified = true;
          },
        },
      };
      const res = handleToolCallGuard(event, ctx);
      expect(res).toBeUndefined();
      expect(notified).toBeTrue();
    });

    it("should block git commit with --no-verify", () => {
      const event: ToolCallEvent = {
        toolName: "bash",
        input: { command: 'git commit --no-verify -m "quick commit"' },
      };
      const res = handleToolCallGuard(event);
      expect(res).toBeDefined();
      expect(res?.block).toBeTrue();
      expect(res?.reason).toContain("Hukum Besi #26");
    });

    it("should block git commit with -n flag", () => {
      const event: ToolCallEvent = {
        toolName: "bash",
        input: { command: 'git commit -n -m "bypass hook"' },
      };
      const res = handleToolCallGuard(event);
      expect(res).toBeDefined();
      expect(res?.block).toBeTrue();
      expect(res?.reason).toContain("Hukum Besi #26");
    });

    it("should notify user when bare mix test is called", () => {
      const event: ToolCallEvent = {
        toolName: "bash",
        input: { command: "mix test" },
      };
      let tipMessage = "";
      const ctx: HookContext = {
        hasUI: true,
        ui: {
          notify: (msg) => {
            tipMessage = msg;
          },
        },
      };
      const res = handleToolCallGuard(event, ctx);
      expect(res).toBeUndefined();
      expect(tipMessage).toContain("scoped test");
    });
  });

  describe("compactTestOutput", () => {
    it("should not modify small outputs", () => {
      const content = [{ type: "text", text: "Finished in 0.05 seconds\n3 tests, 0 failures" }];
      const result = compactTestOutput(content);
      expect(result[0].text).toBe(content[0].text);
    });

    it("should compact long stacktraces in failed mix test outputs", () => {
      const fakeLongTrace = [
        "1) test user registration (MyAppWeb.UserLiveTest)",
        "     test/my_app_web/live/user_live_test.exs:14",
        "     ** (ExUnit.AssertionError)",
        "     Assertion with == failed",
        "     code:  assert response == 200",
        "     left:  500",
        "     right: 200",
        "     stacktrace:",
        "       (elixir 1.18.0) lib/enum.ex:123: Enum.map/2",
        "       (phoenix 1.7.14) lib/phoenix/endpoint/cowboy2_adapter.ex:45: Phoenix.Endpoint.Cowboy2Adapter.init/2",
        "       (ecto 3.12.0) lib/ecto/repo/schema.ex:456: Ecto.Repo.Schema.insert/4",
        "       (phoenix 1.7.14) lib/phoenix/router.ex:400: Phoenix.Router.__call__/2",
        "       (elixir 1.18.0) lib/task/supervised.ex:101: Task.Supervised.invoke_mfa/2",
        "       test/my_app_web/live/user_live_test.exs:20: (test)",
      ].join("\n");

      // Bikin teks melewati 3500 karakter untuk menguji pemadatan
      const paddedTrace = fakeLongTrace + "\n" + "x".repeat(3600);
      const content = [{ type: "text", text: paddedTrace }];
      const result = compactTestOutput(content);
      const compactedText = String(result[0].text);

      expect(compactedText.length).toBeLessThan(paddedTrace.length);
      expect(compactedText).toContain("Assertion with == failed");
      expect(compactedText).toContain("internal framework stacktrace truncated");
    });
  });

  describe("checkDevLoopContinuation", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-test-"));
      await fs.mkdir(path.join(tempDir, "_ompimpa", "status"), { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should return undefined if no status file exists", () => {
      const emptyDir = path.join(tempDir, "empty");
      const res = checkDevLoopContinuation(emptyDir);
      expect(res).toBeUndefined();
    });

    it("should return continue: true if there are ready-for-dev slices", async () => {
      const statusFile = path.join(tempDir, "_ompimpa", "status", "feature-status.yaml");
      await fs.writeFile(
        statusFile,
        `
features:
  feature-1:
    slices:
      slice-1.1:
        status: "ready-for-dev"
`
      );

      const res = checkDevLoopContinuation(tempDir);
      expect(res).toBeDefined();
      expect(res?.continue).toBeTrue();
      expect(res?.additionalContext).toContain("ready-for-dev");
    });

    it("should return undefined if all slices are done", async () => {
      const statusFile = path.join(tempDir, "_ompimpa", "status", "feature-status.yaml");
      await fs.writeFile(
        statusFile,
        `
features:
  feature-1:
    slices:
      slice-1.1:
        status: "done"
`
      );

      const res = checkDevLoopContinuation(tempDir);
      expect(res).toBeUndefined();
    });
  });

  describe("ompimpaGuard factory registration", () => {
    it("should register event handlers with OMP event bus", () => {
      const registeredEvents: string[] = [];
      const mockPi = {
        on: (event: string) => {
          registeredEvents.push(event);
        },
      };

      ompimpaGuard(mockPi as any);

      expect(registeredEvents).toContain("session_start");
      expect(registeredEvents).toContain("tool_call");
      expect(registeredEvents).toContain("tool_result");
      expect(registeredEvents).toContain("ttsr_triggered");
      expect(registeredEvents).toContain("session_stop");
    });
  });
});
