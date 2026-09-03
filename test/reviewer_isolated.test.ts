import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { buildReviewPanel, dispatchIsolatedReview, runReview } from "../src/reviewer";
import { aggregateReviews, deduplicateFindings } from "../src/triage";
import type { OmpimpaConfig } from "../hooks/ompimpa-guard";

describe("B-01 Dispatch 7 Isolated Reviewers via task isolated:true", () => {
  it("AC-B01-1: story in-progress dan panel 7 aktif → dispatchIsolatedReview 7 task isolated:true tulis JSON valid", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-b01-1-"));
    const libDir = path.join(tmp, "lib");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "clean.ex"), `defmodule Clean do\n  def hello, do: :ok\nend`);

    // default config should give 7 panel (1 spec +6 tech)
    const config: OmpimpaConfig = {
      quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6 } },
      stacks: { use_ash_framework: true, use_oban: true },
    };
    const panel = buildReviewPanel(config);
    expect(panel.length).toBe(7);
    expect(panel.map((p) => p.id)).toContain("ompimpa-prd");

    const result = await dispatchIsolatedReview("B-01", { targetDir: tmp });
    expect(result.dispatched).toBe(7);
    expect(result.files.length).toBe(7);
    // each file valid JSON array with severity/file/line/rule_violation/recommendation schema or []
    for (const file of result.files) {
      expect(fsSync.existsSync(file)).toBeTrue();
      const content = await fs.readFile(file, "utf-8");
      const parsed = JSON.parse(content);
      expect(Array.isArray(parsed)).toBeTrue();
      for (const entry of parsed) {
        // if entry exists, must have severity and recommendation
        expect(entry).toHaveProperty("severity");
        // file/line/rule_violation/recommendation are valid keys if present
        if (entry.rule_violation) expect(typeof entry.rule_violation).toBe("string");
        if (entry.recommendation) expect(typeof entry.recommendation).toBe("string");
      }
    }

    // ensure _ompimpa/review dir exists
    expect(fsSync.existsSync(path.join(tmp, "_ompimpa", "review"))).toBeTrue();

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-B01-1: fallback parallel_reviewers=4 → dispatch 5 but still valid", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-b01-fb-"));
    await fs.mkdir(path.join(tmp, "lib"), { recursive: true });
    const config: OmpimpaConfig = {
      quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 4 } },
      stacks: { use_ash_framework: true, use_oban: true },
    };
    const panel = buildReviewPanel(config);
    expect(panel.length).toBe(5);
    const result = await dispatchIsolatedReview("B-01", { targetDir: tmp, panel });
    expect(result.dispatched).toBe(5);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-B01-2: 1 reviewer crash/tidak tulis JSON → aggregateReviews timeout 60s catat P1 High reviewer missing bukan crash", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-b01-2-"));
    await fs.mkdir(path.join(tmp, "lib"), { recursive: true });
    await fs.writeFile(path.join(tmp, "lib", "clean.ex"), "defmodule Clean do\nend");

    const config: OmpimpaConfig = {
      quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6 } },
      stacks: { use_ash_framework: true, use_oban: true },
    };
    const panel = buildReviewPanel(config);
    expect(panel.length).toBe(7);

    const dispatch = await dispatchIsolatedReview("B-01", { targetDir: tmp, panel });
    expect(dispatch.dispatched).toBe(7);
    // simulate crash: delete one reviewer's JSON
    const missingReviewer = panel[2].id; // e.g. ompimpa-security
    const missingFile = path.join(tmp, "_ompimpa", "review", `B-01-${missingReviewer}.json`);
    await fs.rm(missingFile, { force: true });
    expect(fsSync.existsSync(missingFile)).toBeFalse();

    const agg = await aggregateReviews("B-01", { targetDir: tmp, panelIds: panel.map((p) => p.id), timeoutMs: 60000 });
    expect(agg.missing).toContain(missingReviewer);
    // should have P1 High reviewer missing entry
    const missingFinding = agg.findings.find((f) => f.ruleId.includes("reviewer-missing"));
    expect(missingFinding).toBeDefined();
    expect(missingFinding!.severity).toBe("High");
    // dedup still works and remediation sorted
    expect(agg.deduped.length).toBeGreaterThanOrEqual(1);
    // score should be REMEDIATE due to High (P1)
    expect(agg.score.verdict).toBe("REMEDIATE");
    expect(agg.score.p1Count).toBeGreaterThanOrEqual(1);

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-B01-2: aggregate with all present → no missing, PASS if no findings", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-b01-2b-"));
    await fs.mkdir(path.join(tmp, "lib"), { recursive: true });
    const panel: OmpimpaConfig = {
      quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6 } },
      stacks: { use_ash_framework: true, use_oban: true },
    };
    const p = buildReviewPanel(panel);
    await dispatchIsolatedReview("B-01", { targetDir: tmp, panel: p });
    const agg = await aggregateReviews("B-01", { targetDir: tmp, panelIds: p.map((x) => x.id) });
    expect(agg.missing.length).toBe(0);
    expect(agg.score.verdict).toBe("PASS");
    expect(agg.score.score).toBe(100);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-B01-3: runReview() dipanggil tanpa dispatch → prewalk INV-01 P0 Blocker 'Review must be isolated via task'", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-b01-3-"));
    await fs.mkdir(path.join(tmp, "lib"), { recursive: true });
    await fs.writeFile(path.join(tmp, "lib", "app.ex"), `defmodule App do\n  def hello, do: :ok\nend`);
    // ensure no review files
    const reviewDir = path.join(tmp, "_ompimpa", "review");
    if (fsSync.existsSync(reviewDir)) await fs.rm(reviewDir, { recursive: true, force: true });

    const res = await runReview(tmp, { storyId: "B-01", enforceIsolation: true });
    expect(res.verdict).toBe("BLOCKED");
    expect(res.findings.some((f) => f.message.includes("Review must be isolated via task"))).toBeTrue();
    expect(res.findings.some((f) => f.severity === "P0")).toBeTrue();
    expect(res.scorecard.passed).toBeFalse();

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-B01-3: runReview dengan dispatch → tidak P0 isolation, PASSED jika clean", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-b01-3b-"));
    await fs.mkdir(path.join(tmp, "lib"), { recursive: true });
    await fs.writeFile(path.join(tmp, "lib", "app.ex"), `defmodule App do\n  def hello, do: :ok\nend`);
    const config: OmpimpaConfig = {
      quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6 } },
      stacks: { use_ash_framework: true, use_oban: true },
    };
    const panel = buildReviewPanel(config);
    await dispatchIsolatedReview("B-01", { targetDir: tmp, panel });
    const res = await runReview(tmp, { storyId: "B-01" });
    expect(res.findings.some((f) => f.message.includes("Review must be isolated via task"))).toBeFalse();
    // clean code → PASSED
    expect(res.verdict).toBe("PASSED");
    expect(res.scorecard.passed).toBeTrue();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("kill: 7 task >12s fallback 4 — buildReviewPanel parallel_reviewers=4 gives 5 total", () => {
    const config: OmpimpaConfig = {
      quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 4 } },
      stacks: { use_ash_framework: true, use_oban: true },
    };
    const panel = buildReviewPanel(config);
    expect(panel.length).toBe(5);
  });

  it("INV-01 helper isReviewIsolatedCode detects inline violation", async () => {
    const { isReviewIsolatedCode } = await import("../src/reviewer");
    expect(isReviewIsolatedCode("runPrewalkScan(target)")).toBeFalse();
    expect(isReviewIsolatedCode("dispatchIsolatedReview('B-01')\nrunPrewalkScan(target)")).toBeTrue();
    expect(isReviewIsolatedCode("dispatchIsolatedReview('B-01')")).toBeTrue();
  });
});

describe("B-03 Split Spec 1→3/4 BMAD Lens (also in reviewer_isolated)", () => {
  it("AC-B03-1: enable_spec_review=true dan upstream BMAD 4 → panel spec=4 total 10", () => {
    const config: OmpimpaConfig = {
      quality: {
        review: {
          enable_spec_review: true,
          enable_tech_review: true,
          parallel_reviewers: 6,
          // @ts-ignore — B-03 config
          bmad_lens_count: 4,
        },
      },
      stacks: { use_ash_framework: true, use_oban: true },
    } as unknown as OmpimpaConfig;
    const panel = buildReviewPanel(config);
    const specIds = panel.filter((p) => p.id.startsWith("bmad_"));
    expect(specIds.length).toBe(4);
    expect(panel.length).toBe(10);
    expect(specIds.map((p) => p.id)).toEqual(["bmad_adversarial", "bmad_gap_verifier", "bmad_structural", "bmad_completeness"]);
  });

  it("AC-B03-1: bmad_lens_count=3 → spec 3 total 9", () => {
    const config = {
      quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6, bmad_lens_count: 3 } },
      stacks: { use_ash_framework: true, use_oban: true },
    } as unknown as OmpimpaConfig;
    const panel = buildReviewPanel(config);
    expect(panel.filter((p) => p.id.startsWith("bmad_")).length).toBe(3);
    expect(panel.length).toBe(9);
  });

  it("AC-B03-1: default tanpa bmad_lens → spec 1 total 7 (backward compat)", () => {
    const config: OmpimpaConfig = {
      quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6 } },
      stacks: { use_ash_framework: true, use_oban: true },
    };
    const panel = buildReviewPanel(config);
    expect(panel.filter((p) => p.id.startsWith("bmad_")).length).toBe(0);
    expect(panel.filter((p) => p.id === "ompimpa-prd").length).toBe(1);
    expect(panel.length).toBe(7);
  });

  it("AC-B03-2: gap_verifier dispatch writes JSON per lens", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-b03-"));
    await fs.mkdir(path.join(tmp, "lib"), { recursive: true });
    const config = {
      quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6, bmad_lens_count: 3 } },
      stacks: { use_ash_framework: true, use_oban: true },
    } as unknown as OmpimpaConfig;
    const panel = buildReviewPanel(config);
    expect(panel.length).toBe(9);
    const result = await dispatchIsolatedReview("B-03", { targetDir: tmp, panel });
    expect(result.dispatched).toBe(9);
    // each bmad lens file exists and is valid JSON
    for (const member of panel.filter((p) => p.id.startsWith("bmad_"))) {
      const file = path.join(tmp, "_ompimpa", "review", `B-03-${member.id}.json`);
      expect(fsSync.existsSync(file)).toBeTrue();
      const parsed = JSON.parse(await fs.readFile(file, "utf-8"));
      expect(Array.isArray(parsed)).toBeTrue();
    }
    await fs.rm(tmp, { recursive: true, force: true });
  });
});

describe("D-03 Penegakan 10 Isolated Reviewers Sejati (Anti-Mocking)", () => {
  it("AC-D03-1: panel default konfigurasi menghasilkan 10 reviewers sejati (4 BMAD Spec + 6 phxagents Tech)", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-d03-panel-"));
    const config = {
      quality: {
        review: {
          enable_spec_review: true,
          enable_tech_review: true,
          bmad_lens_count: 4,
          parallel_reviewers: 6,
        },
      },
      stacks: { use_ash_framework: false, use_oban: false },
    } as unknown as OmpimpaConfig;

    const panel = buildReviewPanel(config);
    expect(panel.length).toBe(10);

    const specIds = panel.filter((p) => p.id.startsWith("bmad_")).map((p) => p.id);
    expect(specIds).toEqual([
      "bmad_adversarial",
      "bmad_gap_verifier",
      "bmad_structural",
      "bmad_completeness",
    ]);

    const techIds = panel.filter((p) => !p.id.startsWith("bmad_")).map((p) => p.id);
    expect(techIds).toEqual([
      "ompimpa-ironlaw",
      "ompimpa-security",
      "ompimpa-test",
      "ompimpa-verify",
      "ompimpa-ecto",
      "ompimpa-liveview",
    ]);

    const result = await dispatchIsolatedReview("D-03", { targetDir: tmp, panel });
    expect(result.dispatched).toBe(10);
    expect(result.files.length).toBe(10);

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-D03-1: subagent findings murni dipertahankan tanpa ditimpa inline prewalk mock", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-d03-keep-"));
    const reviewDir = path.join(tmp, "_ompimpa", "review");
    await fs.mkdir(reviewDir, { recursive: true });

    // Simulasi subagent bmad_adversarial sejati menulis temuan ke disk
    const subagentFinding = [
      {
        severity: "P0",
        file: "lib/my_app/wallet.ex",
        line: 42,
        rule_violation: "Adversarial race condition detected",
        recommendation: "Use Ecto transaction or GenServer serialization",
      },
    ];
    const adversarialFile = path.join(reviewDir, "D-03-bmad_adversarial.json");
    await fs.writeFile(adversarialFile, JSON.stringify(subagentFinding, null, 2), "utf-8");

    // Dispatch isolated review
    await dispatchIsolatedReview("D-03", { targetDir: tmp });

    // Temuan subagent TIDAK BOLEH ditimpa menjadi []
    const savedContent = JSON.parse(await fs.readFile(adversarialFile, "utf-8"));
    expect(savedContent).toHaveLength(1);
    expect(savedContent[0].rule_violation).toBe("Adversarial race condition detected");
    expect(savedContent[0].file).toBe("lib/my_app/wallet.ex");

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-D03-1: prewalk regex mock dibersihkan dan tidak memalsukan temuan ke reviewer JSON", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-d03-nomock-"));
    const libDir = path.join(tmp, "lib");
    await fs.mkdir(libDir, { recursive: true });
    // Buat file yang melanggar prewalk regex scanner
    await fs.writeFile(
      path.join(libDir, "dirty.ex"),
      `defmodule Dirty do\n  schema "accounts" do\n    field :balance, :float\n  end\nend`
    );

    const reviewDir = path.join(tmp, "_ompimpa", "review");
    await fs.mkdir(reviewDir, { recursive: true });
    const ironlawFile = path.join(reviewDir, "D-03-ompimpa-ironlaw.json");
    // Subagent nyata memutuskan tidak ada temuan (atau pengecualian sah)
    await fs.writeFile(ironlawFile, "[]\n", "utf-8");

    await dispatchIsolatedReview("D-03", { targetDir: tmp });

    // dispatchIsolatedReview TIDAK BOLEH memalsukan temuan dari prewalk regex scan ke file reviewer
    const savedContent = JSON.parse(await fs.readFile(ironlawFile, "utf-8"));
    expect(savedContent).toHaveLength(0);

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("AC-D03-1: commands/review.md memuat kontrak batch tool task dengan 10 subagent isolated: true", async () => {
    const reviewDocPath = path.join(process.cwd(), "commands", "review.md");
    const content = await fs.readFile(reviewDocPath, "utf-8");

    // Memeriksa keberadaan penegakan task, isolation, dan 10 reviewers di commands/review.md
    expect(content).toContain("task");
    expect(content.toLowerCase()).toContain("isolated");
    expect(content).toContain("bmad_adversarial");
    expect(content).toContain("bmad_gap_verifier");
    expect(content).toContain("bmad_structural");
    expect(content).toContain("bmad_completeness");
    expect(content).toContain("ompimpa-ironlaw");
    expect(content).toContain("ompimpa-security");
    expect(content).toContain("ompimpa-test");
    expect(content).toContain("ompimpa-verify");
    expect(content).toContain("_ompimpa/review/");
  });
});
