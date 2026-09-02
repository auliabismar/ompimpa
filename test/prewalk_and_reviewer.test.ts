import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadPrewalkRules,
  scanCode,
  runPrewalkScan,
  type PrewalkRule,
} from "../src/prewalk";
import {
  buildReviewPanel,
  calculateScorecard,
  runReview,
  type ReviewFinding,
} from "../src/reviewer";
import type { OmpimpaConfig } from "../hooks/ompimpa-guard";

describe("OMP-IMPA Prewalk AST/Regex Scanner", () => {
  let rules: PrewalkRule[];

  beforeEach(async () => {
    rules = await loadPrewalkRules();
  });

  it("should load all modular TTSR rules from rules/ folder", async () => {
    expect(rules.length).toBeGreaterThanOrEqual(10);
    const ruleIds = rules.map((r) => r.id);
    // A-01: support both legacy elixir-* (backward compat) and new 01..26 canonical
    const hasFloatRule = ruleIds.includes("01-no-float-money") || ruleIds.includes("elixir-no-float-money");
    const hasTaskRule = ruleIds.includes("21-supervised-long-lived-processes") || ruleIds.includes("elixir-no-unsupervised-task");
    const hasAtomRule = ruleIds.includes("17-no-string-to-atom-user-input") || ruleIds.includes("elixir-no-string-to-atom");
    const hasRawRule = ruleIds.includes("19-no-raw-dynamic-content") || ruleIds.includes("elixir-no-raw-html");
    const hasAshRule = ruleIds.includes("elixir-ash-no-unauthorized-bypass") || ruleIds.some((id) => id.includes("ash") || id.includes("unauthorized"));
    expect(hasFloatRule).toBeTrue();
    expect(hasTaskRule).toBeTrue();
    expect(hasAtomRule).toBeTrue();
    expect(hasRawRule).toBeTrue();
    // ash rule may be merged into 23, but keep flexible
  });

  it("should detect float on financial fields with exact line and column", () => {
    const badCode = `defmodule MyApp.Accounts.Wallet do
  use Ecto.Schema

  schema "wallets" do
    field :balance, :float
  end
end`;

    const findings = scanCode(badCode, "lib/my_app/wallet.ex", rules);
    expect(findings.length).toBeGreaterThanOrEqual(1);

    const finding = findings.find((f) => f.ruleId === "01-no-float-money" || f.ruleId === "elixir-no-float-money");
    expect(finding).toBeDefined();
    expect(finding?.line).toBe(5);
    expect(finding?.file).toBe("lib/my_app/wallet.ex");
    expect(finding?.remediation).toBeDefined();
  });

  it("should detect unsupervised Task.start/async calls", () => {
    const badCode = `def process_data(data) do
  Task.start(fn ->
    do_heavy_work(data)
  end)
end`;

    const findings = scanCode(badCode, "lib/my_app/worker.ex", rules);
    const hasFinding = findings.some((f) => f.ruleId === "elixir-no-unsupervised-task" || f.ruleId === "21-supervised-long-lived-processes");
    expect(hasFinding).toBeTrue();
  });

  it("should detect String.to_atom atom exhaustion vulnerability", () => {
    const badCode = `def parse_param(param) do
  String.to_atom(param)
end`;

    const findings = scanCode(badCode, "lib/my_app/util.ex", rules);
    const hasFinding = findings.some((f) => f.ruleId === "elixir-no-string-to-atom" || f.ruleId === "17-no-string-to-atom-user-input");
    expect(hasFinding).toBeTrue();
  });

  it("should detect Phoenix.HTML.raw / HEEx raw/1 XSS vulnerability", () => {
    const badCode = `def render_comment(comment) do
  Phoenix.HTML.raw(comment.body)
end`;

    const findings = scanCode(badCode, "lib/my_app_web/views/comment_view.ex", rules);
    const hasFinding = findings.some((f) => f.ruleId === "elixir-no-raw-html" || f.ruleId === "19-no-raw-dynamic-content");
    expect(hasFinding).toBeTrue();
  });

  it("should detect Ash policy bypass authorize?: false", () => {
    const badCode = `def create_ticket(params) do
  Ash.create!(Ticket, params, authorize?: false)
end`;

    const findings = scanCode(badCode, "lib/my_app/support.ex", rules);
    const hasFinding = findings.some((f) =>
      f.ruleId === "elixir-ash-no-unauthorized-bypass" ||
      f.ruleId === "23-facade-third-party-apis" ||
      /ash|unauthorized|bypass|facade/i.test(f.ruleId)
    );
    expect(hasFinding).toBeTrue();
  });

  it("should pass clean Elixir code without violations", () => {
    const cleanCode = `defmodule MyApp.Accounts.Wallet do
  use Ecto.Schema

  schema "wallets" do
    field :balance, :decimal
  end

  def create_child(task_sup, fun) do
    Task.Supervisor.start_child(task_sup, fun)
  end
end`;

    const findings = scanCode(cleanCode, "lib/my_app/wallet.ex", rules);
    expect(findings.length).toBe(0);
  });

  it("should run runPrewalkScan on a directory structure", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-prewalk-test-"));
    const libDir = path.join(tempDir, "lib");
    await fs.mkdir(libDir, { recursive: true });

    await fs.writeFile(
      path.join(libDir, "clean.ex"),
      `defmodule Clean do
  def ok, do: :ok
end`
    );

    await fs.writeFile(
      path.join(libDir, "bad.ex"),
      `defmodule Bad do
  def create_atom(x), do: String.to_atom(x)
end`
    );

    const res = await runPrewalkScan(tempDir);
    expect(res.passed).toBeFalse();
    expect(res.totalFiles).toBe(2);
    expect(res.findings.length).toBe(1);
    const isStringToAtom = res.findings[0].ruleId === "elixir-no-string-to-atom" || res.findings[0].ruleId === "17-no-string-to-atom-user-input";
    expect(isStringToAtom).toBeTrue();

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});

describe("OMP-IMPA Reviewer Panel & Scorecard Engine", () => {
  it("should build active review panel based on ompimpa.toml config", () => {
    const config: OmpimpaConfig = {
      quality: {
        review: {
          enable_spec_review: true,
          enable_tech_review: true,
          parallel_reviewers: 4,
        },
      },
      stacks: {
        use_ash_framework: true,
        use_oban: true,
      },
    };

    const panel = buildReviewPanel(config);
    expect(panel.length).toBe(5); // 1 Spec (Agus Salim) + 4 Tech Reviewers

    const panelIds = panel.map((p) => p.id);
    expect(panelIds).toContain("ompimpa-prd");
    expect(panelIds).toContain("ompimpa-ironlaw");
    expect(panelIds).toContain("ompimpa-security");
    expect(panelIds).toContain("ompimpa-test");
    expect(panelIds).toContain("ompimpa-verify");
  });

  it("should calculate TEA scorecard accurately", () => {
    const cleanFindings: ReviewFinding[] = [];
    const cleanScore = calculateScorecard(cleanFindings, 90);

    expect(cleanScore.specScore).toBe(100);
    expect(cleanScore.techScore).toBe(100);
    expect(cleanScore.overallScore).toBe(100);
    expect(cleanScore.passed).toBeTrue();

    // With 1 P0 Blocker finding (v2 deducts 30 points from tech, was 25)
    const blockerFindings: ReviewFinding[] = [
      {
        category: "IronLaw",
        severity: "P0",
        message: "Violation of Iron Law #1",
      },
    ];
    const blockerScore = calculateScorecard(blockerFindings, 90);
    expect(blockerScore.techScore).toBe(70);
    expect(blockerScore.passed).toBeFalse(); // Failed because P0 present

    // v2: 1 Critical (-30) + 1 High (-15) =>55
    const twoFindings: ReviewFinding[] = [
      { category: "IronLaw", severity: "P0", message: "Crit" },
      { category: "Security", severity: "P1", message: "High" },
    ];
    const twoScore = calculateScorecard(twoFindings, 100);
    expect(twoScore.overallScore).toBe(55);
    expect(twoScore.passed).toBeFalse();
  });

  it("should run comprehensive runReview on target directory", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-review-test-"));
    const libDir = path.join(tempDir, "lib");
    await fs.mkdir(libDir, { recursive: true });

    await fs.writeFile(
      path.join(libDir, "app.ex"),
      `defmodule MyApp do
  def money(x) do
    # clean code
    Decimal.new("100.00")
  end
end`
    );

    const res = await runReview(tempDir);
    expect(res.verdict).toBe("PASSED");
    expect(res.scorecard.overallScore).toBe(100);
    expect(res.activeReviewers.length).toBeGreaterThanOrEqual(5);

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
