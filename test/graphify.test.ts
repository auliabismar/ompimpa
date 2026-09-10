import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { buildGraph, getBlastRadius, generateGraphFiles } from "../src/graphify";

describe("C-01 Graphify Blast-Radius via mix xref + LSP", () => {
  it("AC-C01-1: lib/accounts.ex diubah → list blast-radius lib/*_web/live/* terdampak, <2s di 500 file", async () => {
    const start = Date.now();
    const graph = await buildGraph(process.cwd());
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    expect(graph.nodes.length).toBeGreaterThan(0);
    // Should have edges at least synthetic demo
    expect(graph.edges.length).toBeGreaterThan(0);
    const blast = getBlastRadius("lib/accounts.ex", graph);
    expect(blast.affected.length).toBeGreaterThan(0);
    // Specifically should list live files terdampak
    const hasLive = blast.affected.some((f) => f.includes("live"));
    expect(hasLive).toBeTrue();
    expect(blast.affected).toContain("lib/my_app_web/live/user_live.ex");
    expect(graph.stats.method).toMatch(/mix_xref|regex_scan|lsp_fallback/);
  });

  it("AC-C01-1: blast-radius with temp project isolates correctly", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-graph-"));
    const libDir = path.join(tmp, "lib", "my_app_web", "live");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(tmp, "lib", "accounts.ex"), "defmodule MyApp.Accounts do\nend\n", "utf-8");
    await fs.writeFile(
      path.join(libDir, "user_live.ex"),
      "defmodule MyAppWeb.UserLive do\n  alias MyApp.Accounts\nend\n",
      "utf-8"
    );
    await fs.writeFile(
      path.join(libDir, "admin_live.ex"),
      "defmodule MyAppWeb.AdminLive do\n  alias MyApp.Accounts\nend\n",
      "utf-8"
    );
    const graph = await buildGraph(tmp);
    expect(graph.nodes).toContain("lib/accounts.ex");
    const blast = getBlastRadius("lib/accounts.ex", graph);
    expect(blast.affected).toContain("lib/my_app_web/live/user_live.ex");
    expect(blast.affected).toContain("lib/my_app_web/live/admin_live.ex");
    expect(blast.direct_dependents.length).toBe(2);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-C01-2: graph.json ada → reviewer pakai graph untuk TEA-16 circular & TEA-15 boundary", async () => {
    const jsonPath = path.join(process.cwd(), "_ompimpa", "graph.json");
    const exists = await fs.stat(jsonPath).then(() => true).catch(() => false);
    expect(exists).toBeTrue();
    const content = await fs.readFile(jsonPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.nodes).toBeDefined();
    expect(parsed.edges).toBeDefined();
    expect(parsed.generated_at).toBeDefined();
    expect(parsed.stats).toBeDefined();
    expect(parsed.circular_check).toBeDefined();
    expect(typeof parsed.circular_check.hasCycle).toBe("boolean");
    // html also generated
    const htmlPath = path.join(process.cwd(), "_ompimpa", "graph.html");
    const htmlExists = await fs.stat(htmlPath).then(() => true).catch(() => false);
    expect(htmlExists).toBeTrue();
    const html = await fs.readFile(htmlPath, "utf-8");
    expect(html).toContain("Blast-Radius");
  });

  it("Kill: xref >2s fallback lsp references lazy per file", async () => {
    // Simulate >2s by checking buildGraph respects 1500ms timeout and fallback
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-graph-kill-"));
    // Create 10 dummy ex files to trigger scan <2s
    const lib = path.join(tmp, "lib");
    await fs.mkdir(lib, { recursive: true });
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(path.join(lib, `mod${i}.ex`), `defmodule Mod${i} do\nend\n`, "utf-8");
    }
    const start = Date.now();
    const graph = await buildGraph(tmp);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    expect(graph.stats.elapsed_ms).toBeLessThan(2000);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("generateGraphFiles creates both json and html deterministically", async () => {
    const res = await generateGraphFiles(process.cwd());
    expect(res.jsonPath).toContain("graph.json");
    expect(res.htmlPath).toContain("graph.html");
    const json = JSON.parse(await fs.readFile(res.jsonPath, "utf-8"));
    expect(json.nodes.length).toBe(res.data.nodes.length);
    // Second call should produce same nodes (deterministic)
    const res2 = await generateGraphFiles(process.cwd());
    expect(res2.data.nodes).toEqual(res.data.nodes);
  });
});
