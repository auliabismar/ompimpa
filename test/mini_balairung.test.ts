import { describe, it, expect } from "bun:test";
import {
  detectContestedFindings,
  buildMiniBalairungPrompt,
  applyAdjudicationResults,
  parseAdjudicationVerdicts,
  runAdjudicationTask,
  type AdjudicationVerdict,
} from "../src/mini_balairung";
import { calculateScore, type TriageFinding } from "../src/triage";

describe("Mini Balairung Tier 2.5 Hybrid Triage", () => {
  describe("detectContestedFindings", () => {
    it("mengembalikan [] untuk temuan statutori murni dan temuan bersih", () => {
      // Temuan statutori kaku: ruleId cocok /^(01-|02-|03-|04-|05-|07-|13-|14-|17-|IL-|SEC-|CREDO-)/i
      // atau category==="IronLaw" severity Critical/P0
      const statutoryFindings: TriageFinding[] = [
        { file: "lib/wallet.ex", line: 12, ruleId: "01-no-float-money", severity: "Critical" },
        { file: "lib/wallet.ex", line: 12, ruleId: "IL-01", severity: "P0" },
        { file: "lib/auth.ex", line: 50, ruleId: "SEC-01", severity: "Critical" },
        { file: "lib/style.ex", line: 80, ruleId: "CREDO-01", severity: "Low" },
        {
          file: "lib/order.ex",
          line: 25,
          ruleId: "custom-rule",
          category: "IronLaw",
          severity: "Critical",
        },
      ];

      expect(detectContestedFindings(statutoryFindings)).toEqual([]);

      // Temuan bersih tanpa sengketa
      const cleanFindings: TriageFinding[] = [
        { file: "lib/user.ex", line: 10, ruleId: "DOC-01", severity: "Medium" },
        { file: "lib/post.ex", line: 20, ruleId: "NFR-01", severity: "Low" },
      ];

      expect(detectContestedFindings(cleanFindings)).toEqual([]);
    });

    it("mendeteksi severity-clash dan maybe-false pada fixture temuan", () => {
      // severity-clash: 2 finding di file:line sama dengan selisih bobot >= 13 (Critical 30 vs Low 2)
      const clashFindings: TriageFinding[] = [
        {
          file: "lib/user.ex",
          line: 42,
          ruleId: "SPEC-01",
          severity: "Critical",
          message: "Data race condition",
        },
        {
          file: "lib/user.ex",
          line: 42,
          ruleId: "UI-02",
          severity: "Low",
          message: "Nit spacing issue",
        },
      ];

      const clashGroups = detectContestedFindings(clashFindings);
      expect(clashGroups.length).toBe(1);
      expect(clashGroups[0].reason).toBe("severity-clash");
      expect(clashGroups[0].file).toBe("lib/user.ex");
      expect(clashGroups[0].line).toBe(42);
      expect(clashGroups[0].key).toBe("lib/user.ex:42:severity-clash");

      // maybe-false: temuan tunggal dengan verdict="maybe-false"
      const maybeFalseFindings: TriageFinding[] = [
        {
          file: "lib/account.ex",
          line: 99,
          ruleId: "ACC-01",
          severity: "High",
          verdict: "maybe-false",
          evidence: "Mungkin false positive karena ada guard clause",
        },
      ];

      const maybeGroups = detectContestedFindings(maybeFalseFindings);
      expect(maybeGroups.length).toBe(1);
      expect(maybeGroups[0].reason).toBe("maybe-false");
      expect(maybeGroups[0].file).toBe("lib/account.ex");
      expect(maybeGroups[0].line).toBe(99);
      expect(maybeGroups[0].key).toBe("lib/account.ex:99:maybe-false");
    });

    it("mendeteksi remediation-conflict dan boundary-dispute", () => {
      // remediation-conflict: ash vs ecto
      const conflictFindings: TriageFinding[] = [
        {
          file: "lib/repo.ex",
          line: 15,
          ruleId: "ARCH-01",
          severity: "Medium",
          message: "Gunakan Ash resource action",
          recommendation: "ash",
        },
        {
          file: "lib/repo.ex",
          line: 15,
          ruleId: "ARCH-02",
          severity: "Medium",
          message: "Gunakan direct ecto schema query",
          recommendation: "ecto",
        },
      ];

      const conflictGroups = detectContestedFindings(conflictFindings);
      const remGroup = conflictGroups.find((g) => g.reason === "remediation-conflict");
      expect(remGroup).toBeDefined();
      expect(remGroup!.key).toBe("lib/repo.ex:15:remediation-conflict");

      // boundary-dispute: bmad_structural + tech source pada file sama
      const boundaryFindings: TriageFinding[] = [
        {
          file: "lib/web/live.ex",
          line: 10,
          ruleId: "BMAD-STRUC-01",
          severity: "Medium",
          sources: ["bmad_structural"],
        },
        {
          file: "lib/web/live.ex",
          line: 50,
          ruleId: "LV-01",
          severity: "Medium",
          sources: ["ompimpa-liveview"],
        },
      ];

      const boundaryGroups = detectContestedFindings(boundaryFindings);
      const bGroup = boundaryGroups.find((g) => g.reason === "boundary-dispute");
      expect(bGroup).toBeDefined();
      expect(bGroup!.key).toBe("lib/web/live.ex:global:boundary-dispute");
    });
  });

  describe("applyAdjudicationResults & calculateScore", () => {
    it("menurunkan penalti sesuai vonis dan memindahkan final_verdict:false ke rejected", () => {
      const initialFindings: TriageFinding[] = [
        {
          file: "lib/user.ex",
          line: 42,
          ruleId: "SPEC-01",
          severity: "Critical", // 30
          verdict: "high",
        },
        {
          file: "lib/account.ex",
          line: 99,
          ruleId: "ACC-01",
          severity: "High", // 15
          verdict: "maybe-false",
        },
      ];

      // Skor awal: 100 - (30 + 15) = 55 REMEDIATE
      const initialScore = calculateScore(initialFindings);
      expect(initialScore.score).toBe(55);
      expect(initialScore.verdict).toBe("REMEDIATE");

      // Vonis adjudikasi:
      // SPEC-01 diturunkan dari Critical ke Medium
      // ACC-01 divonis false positive (final_verdict: "false")
      const verdicts: AdjudicationVerdict[] = [
        {
          finding_key: "lib/user.ex:42:severity-clash",
          final_severity: "Medium",
          final_verdict: "medium",
          consensus_remediation: "Gunakan transactional boundary biasa.",
        },
        {
          finding_key: "lib/account.ex:99:maybe-false",
          final_severity: "Low",
          final_verdict: "false",
          consensus_remediation: "False positive karena guard clause valid.",
        },
      ];

      const adjudicated = applyAdjudicationResults(initialFindings, verdicts);

      // Pisahkan ke rejected jika final_verdict === "false"
      const rejected = adjudicated.filter((f) => (f.verdict || "").toLowerCase() === "false");
      const deduped = adjudicated.filter((f) => (f.verdict || "").toLowerCase() !== "false");

      expect(rejected.length).toBe(1);
      expect(rejected[0].ruleId).toBe("ACC-01");
      expect(rejected[0].verdict).toBe("false");

      expect(deduped.length).toBe(1);
      expect(deduped[0].ruleId).toBe("SPEC-01");
      expect(deduped[0].severity).toBe("Medium");
      expect(deduped[0].remediation).toBe("Gunakan transactional boundary biasa.");

      // Skor akhir: 100 - 5 (Medium) = 95
      const finalScore = calculateScore(deduped);
      expect(finalScore.score).toBe(95);
      expect(finalScore.verdict).toBe("REMEDIATE"); // allow_p2_nits=false, hanya 100 yang PASS
    });

    it("mencapai 100/100 PASS jika semua temuan bersengketa divonis false", () => {
      const initialFindings: TriageFinding[] = [
        {
          file: "lib/test.ex",
          line: 10,
          ruleId: "FLAKY-01",
          severity: "High",
          verdict: "maybe-false",
        },
      ];

      const verdicts: AdjudicationVerdict[] = [
        {
          finding_key: "lib/test.ex:10:maybe-false",
          final_severity: "Low",
          final_verdict: "false",
          consensus_remediation: "Asersi aman di in-band mock.",
        },
      ];

      const adjudicated = applyAdjudicationResults(initialFindings, verdicts);
      const rejected = adjudicated.filter((f) => (f.verdict || "").toLowerCase() === "false");
      const deduped = adjudicated.filter((f) => (f.verdict || "").toLowerCase() !== "false");

      expect(rejected.length).toBe(1);
      expect(deduped.length).toBe(0);

      const passScore = calculateScore(deduped);
      expect(passScore.score).toBe(100);
      expect(passScore.verdict).toBe("PASS");
    });
  });

  describe("buildMiniBalairungPrompt & parseAdjudicationVerdicts", () => {
    it("menghasilkan prompt berstruktur dengan batas maksimal 8 grup", () => {
      const groups = Array.from({ length: 10 }, (_, i) => ({
        key: `file_${i}.ex:1:severity-clash`,
        file: `file_${i}.ex`,
        line: 1,
        findings: [
          { file: `file_${i}.ex`, line: 1, ruleId: `R-${i}`, severity: "Critical" },
          { file: `file_${i}.ex`, line: 1, ruleId: `R-${i}`, severity: "Low" },
        ],
        reason: "severity-clash" as const,
      }));

      const prompt = buildMiniBalairungPrompt(groups, "STORY-01");
      expect(prompt).toContain("STORY-01");
      expect(prompt).toContain("truncated");
      expect(prompt).toContain("file_0.ex:1:severity-clash");
      expect(prompt).toContain("file_7.ex:1:severity-clash");
      expect(prompt).not.toContain("file_8.ex:1:severity-clash");
    });

    it("mem-parse JSON array dan markdown code block", () => {
      const rawWithFences = "```json\n" + JSON.stringify([
        {
          finding_key: "lib/test.ex:10:severity-clash",
          final_severity: "Medium",
          final_verdict: "medium",
          consensus_remediation: "Perbaiki.",
        },
      ]) + "\n```";

      const parsed = parseAdjudicationVerdicts(rawWithFences);
      expect(parsed).not.toBeNull();
      expect(parsed!.length).toBe(1);
      expect(parsed![0].finding_key).toBe("lib/test.ex:10:severity-clash");
      expect(parsed![0].final_severity).toBe("Medium");
      expect(parsed![0].final_verdict).toBe("medium");

      // Invalid output -> null
      expect(parseAdjudicationVerdicts("Bukan json")).toBeNull();
      expect(parseAdjudicationVerdicts("[]")).toBeNull();
    });

    it("runAdjudicationTask fallback pessimistic ketika executor mengembalikan error atau non-JSON", async () => {
      const groups = [
        {
          key: "lib/foo.ex:1:severity-clash",
          file: "lib/foo.ex",
          line: 1,
          findings: [{ file: "lib/foo.ex", line: 1, ruleId: "R1", severity: "Critical" }],
          reason: "severity-clash" as const,
        },
      ];

      // Executor failure
      const failResult = await runAdjudicationTask(groups, "S-01", {
        executor: async () => ({ code: 1, stdout: "", stderr: "Network error" }),
      });
      expect(failResult.success).toBeFalse();
      expect(failResult.reason).toContain("executor exited with code 1");

      // Non-JSON stdout
      const nonJsonResult = await runAdjudicationTask(groups, "S-01", {
        executor: async () => ({ code: 0, stdout: "Maaf saya tidak bisa menjawab", stderr: "" }),
      });
      expect(nonJsonResult.success).toBeFalse();
      expect(nonJsonResult.reason).toContain("invalid or empty JSON output");
    });
  });
});
