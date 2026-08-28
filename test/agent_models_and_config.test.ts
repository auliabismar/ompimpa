import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseToml,
  loadOmpimpaConfig,
  handleToolCallGuard,
  validateScoreFloor,
  checkDevLoopContinuation,
  type HookContext,
  type ToolCallEvent,
} from "../hooks/ompimpa-guard";
import {
  resolveAgentModel,
  syncAgentModels,
  validateDiataxisStructure,
  parseVerifyStep,
  DEFAULT_MODELS,
} from "../src/cli";
describe("OMP-IMPA Config Loader & Model Bindings", () => {
  const agentsDir = path.resolve(import.meta.dir, "../agents");

  describe("parseToml", () => {
    it("should correctly parse sections, primitives, comments, and arrays", () => {
      const sampleToml = `
# Project Governance
[project]
name = "mimar"
framework = "phoenix"

[quality]
warnings_as_errors = true
max_dev_retries = 3
quality_score_floor = 90

[quality.review]
parallel_reviewers = 6

[models]
balairung = "slow"              # Deliberation
ironlaw = "smol"                # Deterministic check
commit = "smol"

[quality.verify]
steps = ["compile", "format", "test"]
`;

      const config = parseToml(sampleToml);

      expect(config.project?.name).toBe("mimar");
      expect(config.project?.framework).toBe("phoenix");
      expect(config.quality?.warnings_as_errors).toBeTrue();
      expect(config.quality?.max_dev_retries).toBe(3);
      expect(config.quality?.quality_score_floor).toBe(90);
      expect(config.quality?.review?.parallel_reviewers).toBe(6);
      expect(config.models?.balairung).toBe("slow");
      expect(config.models?.ironlaw).toBe("smol");
      expect(config.models?.commit).toBe("smol");
      expect(config.quality?.verify?.steps).toEqual(["compile", "format", "test"]);
    });

    it("should handle empty or missing values gracefully", () => {
      const config = parseToml("");
      expect(config).toEqual({});
    });
  });

  describe("loadOmpimpaConfig", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-test-config-"));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should return empty object if ompimpa.toml does not exist", () => {
      const config = loadOmpimpaConfig(tempDir);
      expect(config).toEqual({});
    });

    it("should load and parse ompimpa.toml when present", async () => {
      const tomlContent = `
[models]
ideate = "slow"
ironlaw = "smol"
`;
      await fs.writeFile(path.join(tempDir, "ompimpa.toml"), tomlContent, "utf-8");
      const config = loadOmpimpaConfig(tempDir);
      expect(config.models?.ideate).toBe("slow");
      expect(config.models?.ironlaw).toBe("smol");
    });
  });

  describe("Agent YAML Frontmatter Model Bindings", () => {
    it("should ensure all 14 agent definition files have explicit model bindings", async () => {
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter((f) => f.startsWith("ompimpa-") && f.endsWith(".md"));

      expect(agentFiles.length).toBe(14);

      for (const file of agentFiles) {
        const content = await fs.readFile(path.join(agentsDir, file), "utf-8");
        const modelMatch = content.match(/^---\n[\s\S]*?\bmodel:\s*([a-zA-Z0-9_-]+)\n[\s\S]*?---/);

        expect(modelMatch).not.toBeNull();
        const model = modelMatch![1];
        expect(["slow", "plan", "design", "default", "smol"]).toContain(model);
      }
    });

    it("should match default tier assignments", () => {
      expect(resolveAgentModel("ompimpa-ironlaw")).toBe("smol");
      expect(resolveAgentModel("ompimpa-commit")).toBe("smol");
      expect(resolveAgentModel("ompimpa-balairung")).toBe("slow");
      expect(resolveAgentModel("ompimpa-ideate")).toBe("slow");
      expect(resolveAgentModel("ompimpa-security")).toBe("slow");
      expect(resolveAgentModel("ompimpa-debug")).toBe("slow");
      expect(resolveAgentModel("ompimpa-prd")).toBe("plan");
      expect(resolveAgentModel("ompimpa-adr")).toBe("plan");
      expect(resolveAgentModel("ompimpa-ui")).toBe("design");
      expect(resolveAgentModel("ompimpa-ash")).toBe("default");
      expect(resolveAgentModel("ompimpa-liveview")).toBe("default");
      expect(resolveAgentModel("ompimpa-ecto")).toBe("default");
      expect(resolveAgentModel("ompimpa-test")).toBe("default");
      expect(resolveAgentModel("ompimpa-doc")).toBe("default");
    });
  });

  describe("syncAgentModels", () => {
    let tempDir: string;
    let tempAgentsDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-sync-project-"));
      tempAgentsDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-sync-agents-"));

      // Copy agent files to temp agents dir
      const files = await fs.readdir(agentsDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          const content = await fs.readFile(path.join(agentsDir, file), "utf-8");
          await fs.writeFile(path.join(tempAgentsDir, file), content, "utf-8");
        }
      }
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.rm(tempAgentsDir, { recursive: true, force: true });
    });

    it("should synchronize agent models based on custom ompimpa.toml", async () => {
      // Create ompimpa.toml with custom overrides
      const customToml = `
[models]
ironlaw = "slow"
dev = "plan"
`;
      await fs.writeFile(path.join(tempDir, "ompimpa.toml"), customToml, "utf-8");

      const res = await syncAgentModels(tempDir, tempAgentsDir);
      expect(res.total).toBe(14);
      expect(res.updated.length).toBeGreaterThan(0);

      // Verify updated agent file
      const ironlawContent = await fs.readFile(path.join(tempAgentsDir, "ompimpa-ironlaw.md"), "utf-8");
      expect(ironlawContent).toContain("model: slow");

      const ashContent = await fs.readFile(path.join(tempAgentsDir, "ompimpa-ash.md"), "utf-8");
      expect(ashContent).toContain("model: plan");
    });
  });

  describe("Hook warnings_as_errors integration", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-hook-test-"));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should notify when mix compile is called without flags if warnings_as_errors is true in config", async () => {
      await fs.writeFile(
        path.join(tempDir, "ompimpa.toml"),
        `
[quality]
warnings_as_errors = true
`,
        "utf-8"
      );

      const notifications: string[] = [];
      const ctx: HookContext = {
        cwd: tempDir,
        hasUI: true,
        ui: {
          notify: (msg) => {
            notifications.push(msg);
          },
        },
      };

      const event: ToolCallEvent = {
        toolName: "bash",
        input: { command: "mix compile" },
      };

      handleToolCallGuard(event, ctx);
      expect(notifications.some((n) => n.includes("warnings_as_errors"))).toBeTrue();
    });
  });

  describe("validateScoreFloor", () => {
    it("should pass when score is above or equal to floor", () => {
      const res1 = validateScoreFloor(95, { quality: { quality_score_floor: 90 } });
      expect(res1.pass).toBeTrue();

      const res2 = validateScoreFloor(90, { quality: { quality_score_floor: 90 } });
      expect(res2.pass).toBeTrue();
    });

    it("should fail when score is below floor", () => {
      const res = validateScoreFloor(85, { quality: { quality_score_floor: 90 } });
      expect(res.pass).toBeFalse();
      expect(res.reason).toContain("85");
      expect(res.reason).toContain("90");
    });
  });

  describe("checkDevLoopContinuation Circuit Breaker", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-cb-test-"));
      await fs.mkdir(path.join(tempDir, "_ompimpa", "status"), { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should trip circuit breaker when retries reach max_dev_retries", async () => {
      await fs.writeFile(
        path.join(tempDir, "ompimpa.toml"),
        `
[quality]
max_dev_retries = 3
`,
        "utf-8"
      );

      await fs.writeFile(
        path.join(tempDir, "_ompimpa", "status", "feature-status.yaml"),
        `
story_1_1:
  status: "in-progress"
  retries: 3
`,
        "utf-8"
      );

      const res = checkDevLoopContinuation(tempDir);
      expect(res).toBeDefined();
      expect(res?.decision).toBe("block");
      expect(res?.continue).toBeFalse();
      expect(res?.reason).toContain("Circuit Breaker");
    });
  });

  describe("validateDiataxisStructure", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-diataxis-test-"));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should validate complete 4-quadrant Diátaxis structure", async () => {
      const docsDir = path.join(tempDir, "docs");
      await fs.mkdir(path.join(docsDir, "tutorials"), { recursive: true });
      await fs.mkdir(path.join(docsDir, "how-to"), { recursive: true });
      await fs.mkdir(path.join(docsDir, "reference"), { recursive: true });
      await fs.mkdir(path.join(docsDir, "explanation"), { recursive: true });

      await fs.writeFile(path.join(docsDir, "tutorials", "get-started.md"), "# Tutorial");

      const res = await validateDiataxisStructure(tempDir, "docs");
      expect(res.valid).toBeTrue();
      expect(res.quadrants.tutorials).toBe(1);
      expect(res.quadrants["how-to"]).toBe(0);
    });

    it("should flag missing quadrants", async () => {
      const docsDir = path.join(tempDir, "docs");
      await fs.mkdir(path.join(docsDir, "tutorials"), { recursive: true });

      const res = await validateDiataxisStructure(tempDir, "docs");
      expect(res.valid).toBeFalse();
      expect(res.issues.length).toBeGreaterThan(0);
    });
  });

  describe("parseVerifyStep", () => {
    it("should parse standard mix steps", () => {
      const step1 = parseVerifyStep("compile --warnings-as-errors");
      expect(step1.cmd).toBe("mix");
      expect(step1.args).toEqual(["compile", "--warnings-as-errors"]);

      const step2 = parseVerifyStep("mix format --check-formatted");
      expect(step2.cmd).toBe("mix");
      expect(step2.args).toEqual(["format", "--check-formatted"]);

      const step3 = parseVerifyStep("credo --strict");
      expect(step3.cmd).toBe("mix");
      expect(step3.args).toEqual(["credo", "--strict"]);
    });
  });
});
