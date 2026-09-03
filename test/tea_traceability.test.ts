import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  auditTeaTraceability,
  detectFalseGreens,
  extractStoryACs,
  checkACTraceability,
  aggregateReviews,
  calculateScore,
  loadRegistry,
  type TriageFinding,
} from "../src/triage";
import { runReview, dispatchIsolatedReview, buildReviewPanel } from "../src/reviewer";
import type { OmpimpaConfig } from "../hooks/ompimpa-guard";

describe("Story E-01: In-Band TEA-01 Traceability & Mutation Guard (ATDD Red-Phase)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-tea01-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("1. Acceptance Criteria Extraction & Traceability Check", () => {
    it("ekstrak daftar AC dari teks spesifikasi mikro SPEC-[ID].md", () => {
      const sampleSpec = `
# SPEC-TEST-01: Sample Feature
## 2. Skenario Gherkin Presisi
\`\`\`gherkin
Feature: Sample
  @ac-sample-1
  Scenario: AC-TEST-1 - Form submission
    Given valid input
    When submit
    Then success

  @ac-sample-2
  Scenario: AC-TEST-2 - Duplicate email rejection
    Given email already exists
    When submit
    Then error displayed

  @ac-sample-3
  Scenario: AC-TEST-3 - Async notification dispatch
    Given transaction confirmed
    When processed
    Then notification queued
\`\`\`
`;
      const acs = extractStoryACs(sampleSpec);
      expect(acs).toHaveLength(3);
      expect(acs).toContain("AC-TEST-1");
      expect(acs).toContain("AC-TEST-2");
      expect(acs).toContain("AC-TEST-3");
    });

    it("AC-E01-1: story spec memiliki 3 AC tapi tes hanya menguji 2 AC → terdeteksi TEA-01 High Finding (-15) dan skor <100", async () => {
      const specACs = ["AC-E01-1", "AC-E01-2", "AC-E01-3"];
      const testContent = `
import { describe, it, expect } from "bun:test";

describe("Sample Test Suite", () => {
  it("AC-E01-1: validasi input form", () => {
    const res = { ok: true };
    expect(res.ok).toBe(true);
  });

  it("AC-E01-2: email duplikat ditolak", () => {
    const error = "Email taken";
    expect(error).toContain("taken");
  });
  // AC-E01-3 sengaja tidak diuji di sini
});
`;
      const result = checkACTraceability(specACs, [
        { file: "test/sample.test.ts", content: testContent },
      ]);

      expect(result.coveredACs).toHaveLength(2);
      expect(result.coveredACs).toContain("AC-E01-1");
      expect(result.coveredACs).toContain("AC-E01-2");

      expect(result.missingACs).toHaveLength(1);
      expect(result.missingACs).toContain("AC-E01-3");

      // Validasi finding yang dihasilkan
      expect(result.findings).toHaveLength(1);
      const finding = result.findings[0];
      expect(finding.ruleId).toBe("TEA-01");
      expect(finding.severity).toBe("High");
      expect(finding.message).toContain("AC-E01-3");

      // Scorecard deduction calculation: 100 - 15 = 85 (<100 REMEDIATE)
      const scoreRes = calculateScore(result.findings);
      expect(scoreRes.score).toBe(85);
      expect(scoreRes.p1Count).toBe(1);
      expect(scoreRes.verdict).toBe("REMEDIATE");
    });

    it("100% AC terpenuhi dengan asersi sah → 0 missing AC findings dan score 100 PASS", () => {
      const specACs = ["AC-E01-1", "AC-E01-2"];
      const testContent = `
describe("Feature Suite", () => {
  it("AC-E01-1: skenario pertama", () => {
    expect(1 + 1).toBe(2);
  });
  it("AC-E01-2: skenario kedua", () => {
    expect("hello").toBe("hello".trim());
  });
});
`;
      const result = checkACTraceability(specACs, [
        { file: "test/full.test.ts", content: testContent },
      ]);
      expect(result.missingACs).toHaveLength(0);
      expect(result.findings).toHaveLength(0);

      const scoreRes = calculateScore(result.findings);
      expect(scoreRes.score).toBe(100);
      expect(scoreRes.verdict).toBe("PASS");
    });
  });

  describe("2. In-Band Mutation Guard — Deteksi Asersi Bodong (False Greens)", () => {
    it("mendeteksi asersi formalitas expect(true).toBe(true) pada TypeScript/JS", () => {
      const testCode = `
import { describe, it, expect } from "bun:test";

describe("Bodong Test", () => {
  it("AC-BODONG-1: tes formalitas tanpa verifikasi aktual", () => {
    doSomething();
    expect(true).toBe(true);
  });
});
`;
      const falseGreens = detectFalseGreens(testCode, "test/fake.test.ts");
      expect(falseGreens.length).toBeGreaterThanOrEqual(1);
      const fg = falseGreens.find((f) => f.ruleId === "TEA-01" || f.ruleId === "TEA-30");
      expect(fg).toBeDefined();
      expect(fg!.severity).toBe("High");
      expect(fg!.message?.toLowerCase()).toContain("expect(true).tobe(true)");
      expect(fg!.file).toBe("test/fake.test.ts");
      expect(fg!.line).toBe(7);
    });

    it("mendeteksi asersi formalitas assert true atau assert :ok == :ok pada Elixir ExUnit", () => {
      const elixirTest = `
defmodule MyApp.FakeTest do
  use ExUnit.Case

  test "AC-ELIXIR-1: asersi bodong true" do
    call_service()
    assert true
  end

  test "AC-ELIXIR-2: asersi bodong :ok == :ok" do
    assert :ok == :ok
  end
end
`;
      const falseGreens = detectFalseGreens(elixirTest, "test/fake_test.exs");
      expect(falseGreens.length).toBe(2);
      expect(falseGreens[0].line).toBe(7);
      expect(falseGreens[0].message).toContain("assert true");
      expect(falseGreens[1].line).toBe(11);
      expect(falseGreens[1].message).toContain("assert :ok == :ok");
    });

    it("mendeteksi blok tes kosong tanpa penegasan (empty test case)", () => {
      const emptyTest = `
describe("Empty Suite", () => {
  it("AC-EMPTY-1: tes tanpa asersi", () => {
    // hanya komentar tanpa expect
    const x = 10;
  });
});
`;
      const falseGreens = detectFalseGreens(emptyTest, "test/empty.test.ts");
      expect(falseGreens.length).toBeGreaterThanOrEqual(1);
      expect(falseGreens[0].message?.toLowerCase()).toContain("empty test");
    });

    it("tes dengan asersi substantif tidak memicu false green finding", () => {
      const validTest = `
describe("Valid Suite", () => {
  it("AC-VALID-1: menghitung saldo dengan benar", () => {
    const balance = calculateBalance([100, -20, 50]);
    expect(balance).toBe(130);
    expect(balance).toBeGreaterThan(0);
  });
});
`;
      const falseGreens = detectFalseGreens(validTest, "test/valid.test.ts");
      expect(falseGreens).toHaveLength(0);
    });
  });

  describe("3. Integrasi End-to-End Triage & Review (/triage E-01)", () => {
    it("aggregateReviews mengaudit ketertelusuran spesifikasi secara in-band saat berkas SPEC ada di disk", async () => {
      // Siapkan workspace mikro
      const specsDir = path.join(tmpDir, "_ompimpa", "specs");
      const reviewDir = path.join(tmpDir, "_ompimpa", "review");
      const testDir = path.join(tmpDir, "test");
      await fs.mkdir(specsDir, { recursive: true });
      await fs.mkdir(reviewDir, { recursive: true });
      await fs.mkdir(testDir, { recursive: true });

      // Buat SPEC-E01-MOCK.md dengan 3 AC
      const specContent = `
# SPEC-E01-MOCK: Mock Story
## 2. Skenario Gherkin Presisi
\`\`\`gherkin
Feature: Mock
  @ac-mock-1
  Scenario: AC-MOCK-1 - Fitur 1
  @ac-mock-2
  Scenario: AC-MOCK-2 - Fitur 2
  @ac-mock-3
  Scenario: AC-MOCK-3 - Fitur 3
\`\`\`
`;
      await fs.writeFile(path.join(specsDir, "SPEC-E01-MOCK.md"), specContent, "utf-8");

      // Buat file tes yang hanya menguji AC-MOCK-1 dan AC-MOCK-2
      const testCode = `
import { it, expect } from "bun:test";
it("AC-MOCK-1: lolos", () => expect(1).toBe(1 + 0));
it("AC-MOCK-2: lolos", () => expect("a").toBe("a"));
`;
      await fs.writeFile(path.join(testDir, "mock.test.ts"), testCode, "utf-8");

      // Siapkan 10 file review bersih []
      const panel = buildReviewPanel({
        quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6 } },
        stacks: { use_ash_framework: true, use_oban: true },
      });
      for (const p of panel) {
        await fs.writeFile(path.join(reviewDir, `E01-MOCK-${p.id}.json`), "[]\n", "utf-8");
      }

      // Jalankan aggregateReviews
      const agg = await aggregateReviews("E01-MOCK", {
        targetDir: tmpDir,
        reviewDir,
      });

      // Harus terdeteksi TEA-01 missing AC-MOCK-3
      const tea01Finding = agg.findings.find((f) => f.ruleId === "TEA-01" && f.message?.includes("AC-MOCK-3"));
      expect(tea01Finding).toBeDefined();
      expect(tea01Finding!.severity).toBe("High");
      expect(agg.score.score).toBeLessThan(100);
      expect(agg.score.verdict).toBe("REMEDIATE");
    });

    it("auditTeaTraceability mandiri membaca berkas SPEC dan tests di workspace", async () => {
      const specsDir = path.join(tmpDir, "_ompimpa", "specs");
      const testDir = path.join(tmpDir, "test");
      await fs.mkdir(specsDir, { recursive: true });
      await fs.mkdir(testDir, { recursive: true });

      const specContent = `
# SPEC-AUDIT-1: Direct Audit
## 2. Skenario Gherkin Presisi
\`\`\`gherkin
Feature: Direct Audit
  Scenario: AC-AUDIT-1 - Alpha
  Scenario: AC-AUDIT-2 - Beta
\`\`\`
`;
      await fs.writeFile(path.join(specsDir, "SPEC-AUDIT-1.md"), specContent, "utf-8");

      // Berkas tes memuat asersi bodong pada AC-AUDIT-1
      const testCode = `
import { it, expect } from "bun:test";
it("AC-AUDIT-1: formalitas bodong", () => {
  expect(true).toBe(true);
});
it("AC-AUDIT-2: asersi sah", () => {
  expect(Math.max(1, 5)).toBe(5);
});
`;
      await fs.writeFile(path.join(testDir, "direct.test.ts"), testCode, "utf-8");

      const auditResult = await auditTeaTraceability("AUDIT-1", {
        repoRoot: tmpDir,
      });

      expect(auditResult.coveredACs).toContain("AC-AUDIT-2");
      // AC-AUDIT-1 dianggap false green sehingga tidak dianggap teruji sah atau memicu finding
      expect(auditResult.falseGreens.length).toBeGreaterThanOrEqual(1);
      expect(auditResult.findings.some((f) => f.severity === "High")).toBeTrue();
    });
  });
});
