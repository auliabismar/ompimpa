import { describe, it, expect } from "bun:test";
import * as path from "node:path";
import { loadRegistry, deduplicateFindings, calculateScore, remediationPlan } from "../src/triage";

describe("Triage Dedup Hash file:line:ruleId + Scoring 100/100 — A-03/B-02 (21 tests port)", () => {
  it("AC-A03-1: loadRegistry 35 entries valid, tiap id unik, penalty sesuai registry, ompimpa_panel ter-mapping", async () => {
    const reg = await loadRegistry();
    expect(reg.criteria.length).toBe(35);
    const ids = reg.criteria.map(c => c.id);
    expect(new Set(ids).size).toBe(35);
    // penalty mapping
    const tea01 = reg.criteria.find(c => c.id === "TEA-01");
    expect(tea01).toBeDefined();
    expect(tea01!.penalty).toBe(15);
    const tea08 = reg.criteria.find(c => c.id === "TEA-08");
    expect(tea08).toBeDefined();
    expect(tea08!.penalty).toBe(30);
    // ompimpa_panel mapping
    expect(tea01!.ompimpa_panel).toBeDefined();
    // scoring weights
    expect(reg.scoring_weights.Critical).toBe(30);
    expect(reg.scoring_weights.High).toBe(15);
    expect(reg.scoring_weights.Medium).toBe(5);
    expect(reg.scoring_weights.Low).toBe(2);
  });

  it("AC-A03-2: 1 Critical (-30) + 1 High (-15) => score 55 REMEDIATE P0=1 P1=1", () => {
    const findings = [
      { file: "lib/foo.ex", line: 10, ruleId: "TEA-08", severity: "Critical" },
      { file: "lib/bar.ex", line: 20, ruleId: "TEA-01", severity: "High" },
    ];
    const res = calculateScore(findings as any);
    expect(res.score).toBe(55);
    expect(res.verdict).toBe("REMEDIATE");
    expect(res.p0Count).toBe(1);
    expect(res.p1Count).toBe(1);
  });

  it("AC-A03-3: 0 temuan => score 100 PASS, allow_p2_nits=false tetap BLOCK jika ada Low (score 98)", () => {
    const res0 = calculateScore([]);
    expect(res0.score).toBe(100);
    expect(res0.verdict).toBe("PASS");
    const resLow = calculateScore([{ file: "lib/x.ex", line: 1, ruleId: "TEA-05", severity: "Low" } as any]);
    expect(resLow.score).toBe(98);
    expect(resLow.verdict).toBe("REMEDIATE");
  });

  it("AC-B02-1: 3 reviewer lapor lib/foo.ex:42 rule IL-01 sama => 1 entitas P0 Critical, merged_sources=3, penalty 1× -30 bukan -90", () => {
    const findings = [
      { file: "lib/foo.ex", line: 42, ruleId: "01-no-float-money", severity: "Critical" },
      { file: "lib/foo.ex", line: 42, ruleId: "01-no-float-money", severity: "Critical" },
      { file: "lib/foo.ex", line: 42, ruleId: "01-no-float-money", severity: "High" },
    ];
    const dedup = deduplicateFindings(findings as any);
    expect(dedup.length).toBe(1);
    expect(dedup[0].merged_sources).toBe(3);
    const res = calculateScore(dedup as any);
    expect(res.score).toBe(70); // 100-30=70 (not 100-90)
    expect(res.p0Count).toBe(1);
  });

  it("AC-B02-2: temuan beda rule di baris sama (IL-01 vs IL-04) => 2 entitas terpisah", () => {
    const findings = [
      { file: "lib/foo.ex", line: 42, ruleId: "01-no-float-money", severity: "Critical" },
      { file: "lib/foo.ex", line: 42, ruleId: "04-no-raw-sql-interpolation", severity: "High" },
    ];
    const dedup = deduplicateFindings(findings as any);
    expect(dedup.length).toBe(2);
  });

  it("AC-B02-3: file-level finding line=null => didukung, kunci file:ruleId tanpa line", () => {
    const findings = [
      { file: "lib/app.ex", line: null, ruleId: "TEA-08", severity: "Critical" },
      { file: "lib/app.ex", line: null, ruleId: "TEA-08", severity: "Critical" },
    ];
    const dedup = deduplicateFindings(findings as any);
    expect(dedup.length).toBe(1);
    const diff = [
      { file: "lib/app.ex", line: null, ruleId: "TEA-08", severity: "Critical" },
      { file: "lib/app.ex", line: 42, ruleId: "TEA-08", severity: "Critical" },
    ];
    const dedup2 = deduplicateFindings(diff as any);
    expect(dedup2.length).toBe(2);
  });

  it("AC-B02-4: 1 Critical + 1 High + 1 Medium => score 50 REMEDIATE sorted P0→P1→P2", () => {
    const findings = [
      { file: "lib/a.ex", line: 1, ruleId: "R1", severity: "Critical" },
      { file: "lib/b.ex", line: 2, ruleId: "R2", severity: "High" },
      { file: "lib/c.ex", line: 3, ruleId: "R3", severity: "Medium" },
    ];
    const dedup = deduplicateFindings(findings as any);
    const res = calculateScore(dedup as any);
    expect(res.score).toBe(50);
    expect(res.verdict).toBe("REMEDIATE");
    const plan = remediationPlan(dedup as any);
    expect(plan[0].severity).toBe("Critical");
    expect(plan[1].severity).toBe("High");
    expect(plan[2].severity).toBe("Medium");
  });

  it("dedup keep severity tertinggi (Critical > High > Medium > Low)", () => {
    const findings = [
      { file: "lib/foo.ex", line: 10, ruleId: "R1", severity: "Low" },
      { file: "lib/foo.ex", line: 10, ruleId: "R1", severity: "High" },
      { file: "lib/foo.ex", line: 10, ruleId: "R1", severity: "Critical" },
    ];
    const dedup = deduplicateFindings(findings as any);
    expect(dedup.length).toBe(1);
    expect(dedup[0].severity).toBe("Critical");
  });

  it("dedup with P0/P1/P2 naming keep Critical", () => {
    const findings = [
      { file: "lib/foo.ex", line: 5, ruleId: "R1", severity: "P1" },
      { file: "lib/foo.ex", line: 5, ruleId: "R1", severity: "P0" },
    ];
    const dedup = deduplicateFindings(findings as any);
    expect(dedup[0].severity).toBe("P0");
  });

  it("dedup 3 different files => 3 entities", () => {
    const findings = [
      { file: "lib/a.ex", line: 1, ruleId: "R1", severity: "High" },
      { file: "lib/b.ex", line: 1, ruleId: "R1", severity: "High" },
      { file: "lib/c.ex", line: 1, ruleId: "R1", severity: "High" },
    ];
    const dedup = deduplicateFindings(findings as any);
    expect(dedup.length).toBe(3);
  });

  it("calculateScore only Low 1 => 98 REMEDIATE", () => {
    const res = calculateScore([{ file: "lib/x.ex", line: 1, ruleId: "R1", severity: "Low" } as any]);
    expect(res.score).toBe(98);
    expect(res.verdict).toBe("REMEDIATE");
    expect(res.p2Count).toBe(1);
  });

  it("calculateScore capped at 0 for many Critical", () => {
    const findings = Array.from({ length: 4 }, (_, i) => ({ file: `lib/${i}.ex`, line: i, ruleId: `R${i}`, severity: "Critical" }));
    const res = calculateScore(findings as any);
    expect(res.score).toBe(0); // 100-120 =>0
  });

  it("remediationPlan sorted P0→P1→P2 stable", () => {
    const findings = [
      { file: "lib/c.ex", line: 3, ruleId: "R3", severity: "Low" },
      { file: "lib/a.ex", line: 1, ruleId: "R1", severity: "Critical" },
      { file: "lib/b.ex", line: 2, ruleId: "R2", severity: "High" },
    ];
    const plan = remediationPlan(findings as any);
    expect(plan[0].severity).toBe("Critical");
    expect(plan[2].severity).toBe("Low");
  });

  it("deduplicateFindings empty => 0", () => {
    expect(deduplicateFindings([]).length).toBe(0);
  });

  it("dedup line null vs line 42 distinct", () => {
    const findings = [
      { file: "lib/app.ex", line: null, ruleId: "R1", severity: "High" },
      { file: "lib/app.ex", line: 42, ruleId: "R1", severity: "High" },
    ];
    const dedup = deduplicateFindings(findings as any);
    expect(dedup.length).toBe(2);
  });

  it("calculateScore p counts breakdown", () => {
    const findings = [
      { file: "lib/a.ex", line: 1, ruleId: "R1", severity: "Critical" },
      { file: "lib/b.ex", line: 2, ruleId: "R2", severity: "Critical" },
      { file: "lib/c.ex", line: 3, ruleId: "R3", severity: "High" },
    ];
    const res = calculateScore(findings as any);
    expect(res.p0Count).toBe(2);
    expect(res.p1Count).toBe(1);
    expect(res.totalDeduction).toBe(75);
    expect(res.score).toBe(25);
  });

  it("registry scoring_weights match ompimpa_panel", async () => {
    const reg = await loadRegistry();
    expect(reg.scoring_weights).toEqual({ Critical: 30, High: 15, Medium: 5, Low: 2 });
    // Check at least one entry has ompimpa_panel containing ompimpa-*
    const withPanel = reg.criteria.filter(c => c.ompimpa_panel && c.ompimpa_panel.length > 0);
    expect(withPanel.length).toBeGreaterThan(0);
  });

  it("dedup same ruleId different category still merge (key file:line:ruleId)", () => {
    const findings = [
      { file: "lib/foo.ex", line: 10, ruleId: "R1", severity: "High", category: "Security" },
      { file: "lib/foo.ex", line: 10, ruleId: "R1", severity: "Critical", category: "IronLaw" },
    ];
    const dedup = deduplicateFindings(findings as any);
    expect(dedup.length).toBe(1);
    expect(dedup[0].severity).toBe("Critical");
  });

  it("integration: dedup → calculateScore → remediationPlan end-to-end", () => {
    const raw = [
      { file: "lib/foo.ex", line: 42, ruleId: "01-no-float-money", severity: "Critical" },
      { file: "lib/foo.ex", line: 42, ruleId: "01-no-float-money", severity: "High" },
      { file: "lib/bar.ex", line: 10, ruleId: "17-no-string-to-atom-user-input", severity: "High" },
      { file: "lib/baz.ex", line: null, ruleId: "TEA-05", severity: "Low" },
    ];
    const dedup = deduplicateFindings(raw as any);
    expect(dedup.length).toBe(3);
    const res = calculateScore(dedup as any);
    // 30+15+2=47 => 53
    expect(res.score).toBe(53);
    const plan = remediationPlan(dedup as any);
    expect(plan[0].severity).toBe("Critical");
  });

  it("kill criteria: dedup salah merge beda kategori → fix clustering by category+ruleId (ensure ruleId clustering)", () => {
    // B-02 kill: if dedup incorrectly merges different category same line but different ruleId, it's bug
    // Our dedup uses ruleId, so different ruleId stays separate even if category same
    const findings = [
      { file: "lib/foo.ex", line: 42, ruleId: "IL-01", severity: "Critical", category: "IronLaw" },
      { file: "lib/foo.ex", line: 42, ruleId: "IL-04", severity: "High", category: "IronLaw" },
    ];
    const dedup = deduplicateFindings(findings as any);
    expect(dedup.length).toBe(2);
  });
});
