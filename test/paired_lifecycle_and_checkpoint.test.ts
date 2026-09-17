import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  STATUS_ORDER,
  statusRank,
  canAdvance,
  canWriteStatus,
  statusForMilestone,
  normalizeStatus,
  type CheckpointData,
} from "../src/status";
import {
  updateFeatureStatus,
  runStoryPhases,
  type SubprocessExecutor,
} from "../src/loop_runner";
import { parseFeatureStatusYaml } from "../src/prewalk";
import { writeAdjudicationLedger } from "../src/mini_balairung";

describe("ADR-007 Paired State Machine & Checkpoint Lifecycle", () => {
  it("STATUS_ORDER mencakup urutan berpasangan lengkap sesuai ADR-007", () => {
    expect(STATUS_ORDER).toContain("backlog");
    expect(STATUS_ORDER).toContain("in-story");
    expect(STATUS_ORDER).toContain("ready-for-atdd");
    expect(STATUS_ORDER).toContain("in-atdd");
    expect(STATUS_ORDER).toContain("ready-for-dev");
    expect(STATUS_ORDER).toContain("in-dev");
    expect(STATUS_ORDER).toContain("ready-for-review");
    expect(STATUS_ORDER).toContain("in-review");
    expect(STATUS_ORDER).toContain("ready-for-triage");
    expect(STATUS_ORDER).toContain("in-triage");
    expect(STATUS_ORDER).toContain("done");

    // Verifikasi urutan maju
    expect(statusRank("backlog")).toBeLessThan(statusRank("ready-for-atdd"));
    expect(statusRank("ready-for-atdd")).toBeLessThan(statusRank("ready-for-dev"));
    expect(statusRank("ready-for-dev")).toBeLessThan(statusRank("in-dev"));
    expect(statusRank("in-dev")).toBeLessThan(statusRank("ready-for-review"));
    expect(statusRank("ready-for-review")).toBeLessThan(statusRank("ready-for-triage"));
    expect(statusRank("ready-for-triage")).toBeLessThan(statusRank("done"));
  });

  it("canWriteStatus: melarang regresi dari done, tetapi mengizinkan loopback ready-for-patch -> in-dev", () => {
    // Done tidak boleh mundur
    expect(canWriteStatus("done", "in-dev")).toBeFalse();
    expect(canWriteStatus("done", "ready-for-dev")).toBeFalse();
    expect(canWriteStatus("done", "done")).toBeTrue();

    // Loopback remediasi sah
    expect(canWriteStatus("ready-for-triage", "ready-for-patch")).toBeTrue();
    expect(canWriteStatus("in-triage", "ready-for-patch")).toBeTrue();
    expect(canWriteStatus("ready-for-patch", "in-dev")).toBeTrue();

    // Status terminal gagal selalu diizinkan
    expect(canWriteStatus("in-dev", "failed")).toBeTrue();
    expect(canWriteStatus("in-review", "blocked")).toBeTrue();
  });

  it("updateFeatureStatus: mencatat run, checkpoint data, dan dapat diparse kembali", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-checkpoint-test-"));
    const storyId = "S-01";

    const cp: CheckpointData = {
      phase: "code",
      spec: `_ompimpa/specs/SPEC-${storyId}.md`,
      test_files: ["test/unit_test.exs"],
      files_touched: ["lib/feature.ex"],
      triage_verdict: {
        score: 85,
        verdict: "REMEDIATE",
        blockers: 0,
        warnings: 1,
        summary: "Perlu sanitasi input",
      },
      commit: null,
    };

    try {
      await updateFeatureStatus(tmp, storyId, "ready-for-patch", 1, false, cp, 2);

      const statusFile = path.join(tmp, "_ompimpa", "status", "feature-status.yaml");
      const content = await fs.readFile(statusFile, "utf-8");

      expect(content).toContain("status: ready-for-patch");
      expect(content).toContain("retries: 1");
      expect(content).toContain("run: 2");
      expect(content).toContain("checkpoint:");
      expect(content).toContain("phase: code");
      expect(content).toContain("test/unit_test.exs");
      expect(content).toContain("lib/feature.ex");
      expect(content).toContain("Perlu sanitasi input");

      const parsed = parseFeatureStatusYaml(content);
      const item = parsed.stories.find((s) => s.id === storyId);
      expect(item).toBeDefined();
      expect(item!.status).toBe("ready-for-patch");
      expect(item!.retries).toBe(1);
      expect(item!.run).toBe(2);
      expect(item!.checkpoint?.phase).toBe("code");
      expect(item!.checkpoint?.triage_verdict?.verdict).toBe("REMEDIATE");
      expect(item!.checkpoint?.triage_verdict?.score).toBe(85);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("runStoryPhases Resumability: melompati fase story & atdd jika status sudah ready-for-dev", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-resume-test-"));
    const storyId = "R-01";

    // Buat status awal ready-for-dev di disk
    await fs.mkdir(path.join(tmp, "_ompimpa", "status"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "_ompimpa", "status", "feature-status.yaml"),
      `stories:\n  - id: ${storyId}\n    status: ready-for-dev\n    retries: 0\n    run: 1\n`,
      "utf-8"
    );

    const executedCommands: string[] = [];
    const mockExecutor: SubprocessExecutor = async (cmd: string, args: string[]) => {
      const sub = args[2] || args[1] || "";
      executedCommands.push(sub);
      return { code: 0, stdout: "Score: 100/100 PASS", stderr: "" };
    };

    try {
      const res = await runStoryPhases(storyId, {
        targetDir: tmp,
        executor: mockExecutor,
        resume: true,
      });

      expect(res.success).toBeTrue();

      // Pastikan fase 'story' dan 'atdd' di-skip (checkpoint-resumed)
      const storyPhase = res.phases.find((p) => p.phase === "story");
      const atddPhase = res.phases.find((p) => p.phase === "atdd");
      expect(storyPhase?.cmd).toBe("resumed");
      expect(atddPhase?.cmd).toBe("resumed");

      // Pastikan eksekutor hanya menjalankan 'code', 'review', dan 'triage'
      expect(executedCommands).toContain("code");
      expect(executedCommands).toContain("review");
      expect(executedCommands).toContain("triage");
      expect(executedCommands).not.toContain("story");
      expect(executedCommands).not.toContain("atdd");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("writeAdjudicationLedger: menulis berkas adjudication.json dan meng-append ke SPEC seksi 11", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-adj-test-"));
    const storyId = "ADJ-01";

    // Siapkan berkas SPEC dengan seksi 11
    await fs.mkdir(path.join(tmp, "_ompimpa", "specs"), { recursive: true });
    const initialSpec = `# SPEC-${storyId}\n\n## 10. Spec Change Log\n_Kosong_\n\n## 11. Review Triage Log\n_Kosong_\n\n## 12. Run Ledger\n_Kosong_\n`;
    await fs.writeFile(path.join(tmp, "_ompimpa", "specs", `SPEC-${storyId}.md`), initialSpec, "utf-8");

    const verdicts = [
      {
        finding_key: "lib/feature.ex:10:GAP-01",
        final_severity: "Low" as const,
        final_verdict: "false" as const,
        consensus_remediation: "Bukan gap nyata, skenario sudah tercover",
      },
    ];
    const groups = [
      {
        key: "lib/feature.ex:10:GAP-01",
        file: "lib/feature.ex",
        line: 10,
        reason: "maybe-false" as const,
        findings: [],
      },
    ];

    try {
      const ledgerPath = await writeAdjudicationLedger(tmp, storyId, verdicts, groups, "smol");
      expect(await fs.stat(ledgerPath)).toBeDefined();

      const ledgerContent = JSON.parse(await fs.readFile(ledgerPath, "utf-8"));
      expect(ledgerContent.story).toBe(storyId);
      expect(ledgerContent.model).toBe("smol");
      expect(ledgerContent.records.length).toBe(1);
      expect(ledgerContent.records[0].is_dismissed).toBeTrue();

      // Periksa append ke SPEC seksi 11
      const updatedSpec = await fs.readFile(path.join(tmp, "_ompimpa", "specs", `SPEC-${storyId}.md`), "utf-8");
      expect(updatedSpec).toContain("ADJUDICATION (smol): lib/feature.ex:10:GAP-01 -> false");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
