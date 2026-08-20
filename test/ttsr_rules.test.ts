import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

describe("OMP-IMPA TTSR Stream Rules", () => {
  const rulesDir = path.resolve(import.meta.dir, "../rules");

  it("should have modular TTSR rule files with valid frontmatter", async () => {
    const files = await fs.readdir(rulesDir);
    const modularRules = files.filter(
      (f) => f.startsWith("elixir-") && f.endsWith(".md") && !f.includes("iron-laws")
    );

    expect(modularRules.length).toBeGreaterThanOrEqual(9);

    for (const file of modularRules) {
      const content = await fs.readFile(path.join(rulesDir, file), "utf-8");
      expect(content.startsWith("---")).toBeTrue();
      expect(content).toContain("description:");
      expect(content).toContain("globs:");
      expect(content).toContain("scope:");
      expect(content).toContain("condition:");
      expect(content).toContain("interruptMode:");
    }
  });
});
