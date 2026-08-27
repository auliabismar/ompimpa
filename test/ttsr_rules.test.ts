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

  it("should match unsupervised task violations", async () => {
    const content = await fs.readFile(path.join(rulesDir, "elixir-no-unsupervised-task.md"), "utf-8");
    const regex = /\bTask\.(?:start|start_link|async)\s*\(/;
    
    expect(regex.test("Task.start(fn -> :ok end)")).toBeTrue();
    expect(regex.test("Task.async(fn -> :ok end)")).toBeTrue();
    expect(regex.test("Task.Supervisor.start_child(MyApp.TaskSupervisor, fn -> :ok end)")).toBeFalse();
  });

  it("should match LiveView temporary assigns / direct assign violations", async () => {
    const regex = /assign\(socket,\s*:(?:items|products|users|orders|logs|events|records|posts|messages|comments|rows|list|data),\s*(?:Repo\.all|Ash\.read!?)/;
    
    expect(regex.test("assign(socket, :products, Repo.all(Product))")).toBeTrue();
    expect(regex.test("assign(socket, :items, Ash.read!(Item))")).toBeTrue();
    expect(regex.test("stream(socket, :products, products)")).toBeFalse();
  });

  it("should match LiveView unbounded query violations", async () => {
    const regex = /def\s+(?:mount|handle_params|handle_event)\([^)]*\)[\s\S]*?\bRepo\.all\(\s*(?:[A-Z][a-zA-Z0-9_]*|from\s*\([a-z]\s+in\s+[A-Z][a-zA-Z0-9_]*(?![^)]*\blimit\b))\s*\)/;
    
    const badMount = `def mount(_params, _session, socket) do
      products = Repo.all(Product)
      {:ok, socket}
    end`;
    expect(regex.test(badMount)).toBeTrue();
  });

  it("should match Ash unauthorized policy bypass violations", async () => {
    const regex = /\bAsh\.(?:create|update|destroy|read|bulk_create|bulk_update)!?\([^)]*authorize\?:\s*false/;
    
    expect(regex.test("Ash.create!(Ticket, params, authorize?: false)")).toBeTrue();
    expect(regex.test("Ash.read(User, authorize?: false)")).toBeTrue();
    expect(regex.test("Ash.create!(Ticket, params, actor: current_user)")).toBeFalse();
  });
});
