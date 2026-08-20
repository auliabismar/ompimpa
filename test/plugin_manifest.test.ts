import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

describe("OMP Plugin Manifests & Marketplace Catalog", () => {
  const repoRoot = path.resolve(import.meta.dir, "..");

  it("should have a valid .omp-plugin/marketplace.json catalog", async () => {
    const filePath = path.join(repoRoot, ".omp-plugin", "marketplace.json");
    const content = await fs.readFile(filePath, "utf-8");
    const catalog = JSON.parse(content);

    expect(catalog.name).toBe("ompimpa");
    expect(catalog.owner?.name).toBeDefined();
    expect(Array.isArray(catalog.plugins)).toBeTrue();
    expect(catalog.plugins.length).toBeGreaterThanOrEqual(1);

    const plugin = catalog.plugins[0];
    expect(plugin.name).toBe("ompimpa");
    expect(plugin.source).toBe("./");
    expect(plugin.version).toBe("1.0.0");
    expect(plugin.category).toBe("development");
  });

  it("should have a valid .omp-plugin/plugin.json manifest", async () => {
    const filePath = path.join(repoRoot, ".omp-plugin", "plugin.json");
    const content = await fs.readFile(filePath, "utf-8");
    const manifest = JSON.parse(content);

    expect(manifest.name).toBe("ompimpa");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.author?.name).toBeDefined();
    expect(Array.isArray(manifest.keywords)).toBeTrue();
    expect(manifest.keywords).toContain("phoenix");
    expect(manifest.keywords).toContain("ash");
  });

  it("should have matching .claude-plugin/ fallback manifests", async () => {
    const marketplacePath = path.join(repoRoot, ".claude-plugin", "marketplace.json");
    const pluginPath = path.join(repoRoot, ".claude-plugin", "plugin.json");

    const marketplace = JSON.parse(await fs.readFile(marketplacePath, "utf-8"));
    const plugin = JSON.parse(await fs.readFile(pluginPath, "utf-8"));

    expect(marketplace.name).toBe("ompimpa");
    expect(plugin.name).toBe("ompimpa");
  });

  it("should configure omp.extensions and pi.extensions in package.json", async () => {
    const packageJsonPath = path.join(repoRoot, "package.json");
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    expect(pkg.omp?.extensions).toBeDefined();
    expect(pkg.omp.extensions).toContain("./hooks/ompimpa-guard.ts");
    expect(pkg.pi?.extensions).toBeDefined();
    expect(pkg.pi.extensions).toContain("./hooks/ompimpa-guard.ts");

    // Pastikan file ekstensi benar-benar ada di disk
    const hookPath = path.join(repoRoot, pkg.omp.extensions[0]);
    const hookExists = await fs
      .access(hookPath)
      .then(() => true)
      .catch(() => false);
    expect(hookExists).toBeTrue();
  });
});
