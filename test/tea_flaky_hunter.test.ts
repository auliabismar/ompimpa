import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  detectFlakyPatterns,
  checkTestSpeed,
  auditFlakyAndSlowTests,
  aggregateReviews,
  calculateScore,
  type TestDurationRecord,
  type TriageFinding,
} from "../src/triage";
import { buildReviewPanel } from "../src/reviewer";

describe("Story E-02: Flaky & Slow Test Hunter In-Band (ATDD Red-Phase)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-tea02-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("1. Deteksi Pola Flaky (Process.sleep / Arbitrary Sleep)", () => {
    it("mendeteksi pemanggilan Process.sleep/1 pada berkas tes Elixir ExUnit", () => {
      const elixirTest = `
defmodule MyAppWeb.UserLiveTest do
  use MyAppWeb.ConnCase
  import Phoenix.LiveViewTest

  test "live view stream update", %{conn: conn} do
    {:ok, lv, _html} = live(conn, "/users")
    send(lv.pid, {:user_created, %{id: 1, name: "Alice"}})
    Process.sleep(100)
    assert render(lv) =~ "Alice"
  end
end
`;
      const findings = detectFlakyPatterns(elixirTest, "test/my_app_web/user_live_test.exs");
      expect(findings.length).toBe(1);
      const f = findings[0];
      expect(f.severity).toBe("High");
      expect(f.ruleId).toMatch(/TEA-08|flaky-sleep/);
      expect(f.line).toBe(9);
      expect(f.message).toContain("Process.sleep");
      expect(f.recommendation).toContain("assert_receive");
      expect(f.sources).toContain("ompimpa-test");
    });

    it("mendeteksi pemanggilan :timer.sleep pada berkas tes Elixir", () => {
      const elixirTest = `
test "async job worker completion" do
  perform_job()
  :timer.sleep(250)
  assert job_completed?()
end
`;
      const findings = detectFlakyPatterns(elixirTest, "test/worker_test.exs");
      expect(findings.length).toBe(1);
      expect(findings[0].severity).toBe("High");
      expect(findings[0].message).toContain(":timer.sleep");
    });

    it("mengabaikan Process.sleep yang berada di dalam baris komentar", () => {
      const elixirTest = `
test "clean synchronization with assert_receive" do
  # Jangan gunakan Process.sleep(100) di sini
  # Process.sleep 50
  assert_receive {:done, 123}, 500
end
`;
      const findings = detectFlakyPatterns(elixirTest, "test/clean_test.exs");
      expect(findings.length).toBe(0);
    });

    it("mendeteksi sleep / setTimeout sewenang-wenang pada berkas tes TypeScript/JS", () => {
      const tsTest = `
import { it, expect } from "bun:test";

it("waits for event via arbitrary sleep", async () => {
  triggerEvent();
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(hasFired()).toBe(true);
});
`;
      const findings = detectFlakyPatterns(tsTest, "test/flaky_ui.test.ts");
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe("High");
      expect(findings[0].message).toMatch(/setTimeout|sleep/);
    });

    it("berkas tes bersih tanpa sleep tidak menghasilkan temuan flaky", () => {
      const cleanElixir = `
test "deterministic pattern matching with assert_receive" do
  send(self(), {:msg, "ok"})
  assert_receive {:msg, "ok"}
end
`;
      const findings = detectFlakyPatterns(cleanElixir, "test/pure_test.exs");
      expect(findings.length).toBe(0);
    });
  });

  describe("2. Ambang Batas Kecepatan Pengujian In-Band (Speed Threshold <= 50ms)", () => {
    it("menghasilkan temuan P1 High jika durasi pengujian melebihi 50ms", () => {
      const records: TestDurationRecord[] = [
        {
          name: "test user creation liveview mount",
          file: "test/my_app_web/user_live_test.exs",
          line: 12,
          durationMs: 78,
        },
      ];

      const findings = checkTestSpeed(records, 50);
      expect(findings.length).toBe(1);
      const f = findings[0];
      expect(f.severity).toBe("High");
      expect(f.ruleId).toMatch(/TEA-26|slow-test/);
      expect(f.message).toContain("78ms");
      expect(f.message).toContain("50ms");
      expect(f.sources).toContain("ompimpa-test");
    });

    it("pengujian dengan durasi <= 50ms lolos tanpa temuan", () => {
      const records: TestDurationRecord[] = [
        {
          name: "fast unit test",
          file: "test/unit_test.exs",
          line: 5,
          durationMs: 4,
        },
        {
          name: "in-process liveview interaction",
          file: "test/live_test.exs",
          line: 20,
          durationMs: 48,
        },
        {
          name: "exact boundary 50ms",
          file: "test/boundary_test.exs",
          line: 35,
          durationMs: 50,
        },
      ];

      const findings = checkTestSpeed(records, 50);
      expect(findings.length).toBe(0);
    });

    it("mendukung kustomisasi ambang batas durasi (custom threshold)", () => {
      const records: TestDurationRecord[] = [
        {
          name: "custom threshold test",
          file: "test/custom_test.exs",
          line: 10,
          durationMs: 35,
        },
      ];

      // Dengan ambang 30ms, 35ms memicu temuan
      const findingsStrict = checkTestSpeed(records, 30);
      expect(findingsStrict.length).toBe(1);

      // Dengan ambang default 50ms, 35ms lolos
      const findingsDefault = checkTestSpeed(records, 50);
      expect(findingsDefault.length).toBe(0);
    });
  });

  describe("3. Skenario Kriteria Penerimaan Gherkin (AC-E02-1 & AC-E02-2)", () => {
    it("AC-E02-1: berkas tes memuat Process.sleep -> review dijalankan -> terdeteksi P1 High flaky-sleep finding", async () => {
      // Given berkas tes memuat Process.sleep
      const testDir = path.join(tmpDir, "test");
      await fs.mkdir(testDir, { recursive: true });

      const testContent = `
defmodule FlakyCaseTest do
  use ExUnit.Case

  test "AC-E02-1: flaky sleep scenario" do
    send_payload()
    Process.sleep(200)
    assert true == true_result()
  end
end
`;
      const testPath = path.join(testDir, "flaky_case_test.exs");
      await fs.writeFile(testPath, testContent, "utf-8");

      // When review/audit dijalankan
      const auditResult = await auditFlakyAndSlowTests("E-02", {
        repoRoot: tmpDir,
        testFiles: [testPath],
      });

      // Then terdeteksi P1 High flaky-sleep finding
      expect(auditResult.flakyFindings.length).toBeGreaterThanOrEqual(1);
      const flakyFinding = auditResult.flakyFindings.find((f) =>
        f.message?.includes("Process.sleep") || f.rule_violation?.includes("Process.sleep")
      );
      expect(flakyFinding).toBeDefined();
      expect(flakyFinding!.severity).toBe("High");
      expect(flakyFinding!.sources).toContain("ompimpa-test");
    });

    it("AC-E02-2: pengujian durasi in-process LiveViewTest melebihi 50ms -> terdeteksi P1 High slow-test finding", async () => {
      // Given pengujian durasi in-process LiveViewTest melebihi 50ms
      const slowRecord: TestDurationRecord = {
        name: "AC-E02-2: slow in-process LiveView test",
        file: "test/slow_live_test.exs",
        line: 15,
        durationMs: 125,
      };

      // When pemeriksaan kecepatan pengujian dijalankan
      const auditResult = await auditFlakyAndSlowTests("E-02", {
        repoRoot: tmpDir,
        durations: [slowRecord],
        speedThresholdMs: 50,
      });

      // Then terdeteksi P1 High slow-test finding
      expect(auditResult.slowFindings.length).toBe(1);
      const slowFinding = auditResult.slowFindings[0];
      expect(slowFinding.severity).toBe("High");
      expect(slowFinding.message).toContain("125ms");
      expect(slowFinding.message).toContain("50ms");
    });
  });

  describe("4. Integrasi End-to-End Triage (/triage E-02 Scorecard 100/100 Enforcement)", () => {
    it("aggregateReviews mendeteksi pelanggaran Process.sleep dan memicu status REMEDIATE (<100)", async () => {
      const specsDir = path.join(tmpDir, "_ompimpa", "specs");
      const reviewDir = path.join(tmpDir, "_ompimpa", "review");
      const testDir = path.join(tmpDir, "test");
      await fs.mkdir(specsDir, { recursive: true });
      await fs.mkdir(reviewDir, { recursive: true });
      await fs.mkdir(testDir, { recursive: true });

      // Spec E-02
      const specContent = `
# SPEC-E-02: Flaky & Slow Test Hunter In-Band
## 2. Skenario Gherkin Presisi
\`\`\`gherkin
Feature: E-02 - Flaky & Slow Test Hunter In-Band
  @ac-e02-1
  Scenario: AC-E02-1 - review dijalankan
  @ac-e02-2
  Scenario: AC-E02-2 - pemeriksaan kecepatan pengujian dijalankan
\`\`\`
`;
      await fs.writeFile(path.join(specsDir, "SPEC-E-02.md"), specContent, "utf-8");

      // Berkas tes dengan Process.sleep
      const testCode = `
import { it, expect } from "bun:test";

it("AC-E02-1: tes dengan sleep", async () => {
  await new Promise((r) => setTimeout(r, 80));
  expect(1 + 1).toBe(2);
});

it("AC-E02-2: tes substantif tanpa sleep", () => {
  expect(Math.sqrt(16)).toBe(4);
});
`;
      await fs.writeFile(path.join(testDir, "e02_sample.test.ts"), testCode, "utf-8");

      // 10 panel review JSON
      const panel = buildReviewPanel({
        quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6 } },
        stacks: { use_ash_framework: true, use_oban: true },
      });
      for (const p of panel) {
        await fs.writeFile(path.join(reviewDir, `E-02-${p.id}.json`), "[]\n", "utf-8");
      }

      // Jalankan aggregateReviews
      const agg = await aggregateReviews("E-02", {
        targetDir: tmpDir,
        reviewDir,
      });

      // Harus terdeteksi temuan flaky sleep
      const flakyFound = agg.findings.some(
        (f) => f.ruleId.includes("TEA-08") || f.message?.includes("sleep") || f.message?.includes("setTimeout")
      );
      expect(flakyFound).toBeTrue();
      expect(agg.score.score).toBeLessThan(100);
      expect(agg.score.verdict).toBe("REMEDIATE");
    });

    it("suite tes bersih tanpa Process.sleep dan lolos speed check mencapai skor 100/100 PASS", async () => {
      const specsDir = path.join(tmpDir, "_ompimpa", "specs");
      const reviewDir = path.join(tmpDir, "_ompimpa", "review");
      const testDir = path.join(tmpDir, "test");
      await fs.mkdir(specsDir, { recursive: true });
      await fs.mkdir(reviewDir, { recursive: true });
      await fs.mkdir(testDir, { recursive: true });

      const specContent = `
# SPEC-E-02: Flaky & Slow Test Hunter In-Band
## 2. Skenario Gherkin Presisi
\`\`\`gherkin
Feature: E-02 - Flaky & Slow Test Hunter In-Band
  @ac-e02-1
  Scenario: AC-E02-1 - review dijalankan
  @ac-e02-2
  Scenario: AC-E02-2 - pemeriksaan kecepatan pengujian dijalankan
\`\`\`
`;
      await fs.writeFile(path.join(specsDir, "SPEC-E-02.md"), specContent, "utf-8");

      const testCode = `
import { it, expect } from "bun:test";

it("AC-E02-1: tes deterministik tanpa sleep", () => {
  const result = 40 + 2;
  expect(result).toBe(42);
});

it("AC-E02-2: tes cepat deterministik", () => {
  const greeting = "hello " + "world";
  expect(greeting).toBe("hello world");
});
`;
      await fs.writeFile(path.join(testDir, "clean_e02.test.ts"), testCode, "utf-8");

      const panel = buildReviewPanel({
        quality: { review: { enable_spec_review: true, enable_tech_review: true, parallel_reviewers: 6 } },
        stacks: { use_ash_framework: true, use_oban: true },
      });
      for (const p of panel) {
        await fs.writeFile(
          path.join(reviewDir, `E-02-${p.id}.json`),
          JSON.stringify({ reviewer: p.id, story: "E-02", completedAt: "2026-09-08T00:00:00Z", findings: [] }),
          "utf-8"
        );
      }
      // Kontrak jujur: [] dihitung bersih hanya dengan marker sesi review completed.
      await fs.writeFile(
        path.join(reviewDir, "E-02.review.result.json"),
        JSON.stringify({ role: "review", story: "E-02", completed: true, files: panel.map((p) => `E-02-${p.id}.json`) }),
        "utf-8"
      );

      const agg = await aggregateReviews("E-02", {
        targetDir: tmpDir,
        reviewDir,
        sessionMarker: { role: "review", story: "E-02", completed: true, files: panel.map((p) => `E-02-${p.id}.json`) },
      });

      expect(agg.score.score).toBe(100);
      expect(agg.score.verdict).toBe("PASS");
      expect(agg.findings.length).toBe(0);
    });
  });
});
