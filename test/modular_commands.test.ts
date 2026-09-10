import { describe, it, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";
import { handleCode, handleTriage } from "../src/cli";

const REPO_ROOT = path.resolve(import.meta.dir, "..");

async function runCli(
  args: string[],
  cwd: string = REPO_ROOT
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cliPath = path.join(REPO_ROOT, "src/cli.ts");
    const proc = spawn("bun", ["run", cliPath, ...args], { cwd, stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

describe("Story D-02: Modular Commands (/code, /triage) & Refaktor /dev (AC-D02-1)", () => {
  describe("1. Verifikasi Kontrak Berkas Perintah Markdown", () => {
    it("commands/code.md: memuat metadata, INV-08, INV-09, spesialis stack, dan circuit breaker", async () => {
      const filePath = path.join(REPO_ROOT, "commands", "code.md");
      const content = await fs.readFile(filePath, "utf-8");

      expect(content).toContain("# Command: /ompimpa:code");
      expect(content).toContain("/code <STORY_ID>");
      expect(content).toContain("INV-08");
      expect(content).toContain("INV-09");
      expect(content).toContain("Circuit Breaker");
      expect(content).toContain("3 siklus");

      // Stack specialists
      expect(content).toContain("ompimpa-ash");
      expect(content).toContain("ompimpa-ecto");
      expect(content).toContain("ompimpa-liveview");
      expect(content).toContain("ompimpa-oban");
      expect(content).toContain("ompimpa-otp");

      // Scoped test rule
      expect(content).toContain("Scoped Test");
    });

    it("commands/triage.md: memuat metadata, INV-08, D2 Zero-Gap Determinism, hash dedup, dan v2 scoring", async () => {
      const filePath = path.join(REPO_ROOT, "commands", "triage.md");
      const content = await fs.readFile(filePath, "utf-8");

      expect(content).toContain("# Command: /ompimpa:triage");
      expect(content).toContain("/triage <STORY_ID>");
      expect(content).toContain("INV-08");
      expect(content).toContain("Zero-Gap Determinism");
      expect(content).toContain("src/triage.ts");
      expect(content).toContain("file:line:ruleId");

      // Scoring weights v2
      expect(content).toContain("-30");
      expect(content).toContain("-15");
      expect(content).toContain("-5");
      expect(content).toContain("-2");

      // Verdicts
      expect(content).toContain("PASS");
      expect(content).toContain("REMEDIATE");
      expect(content).toContain("Remediation Plan");
    });

    it("commands/dev.md: memuat 5 fase modular, INV-08, dan membedakan in-harness vs outer CLI", async () => {
      const filePath = path.join(REPO_ROOT, "commands", "dev.md");
      const content = await fs.readFile(filePath, "utf-8");

      expect(content).toContain("# Command: /ompimpa:dev (Pipeline Coordinator)");
      expect(content).toContain("INV-08");

      // 5 fase modular atomik
      expect(content).toContain("/story");
      expect(content).toContain("/atdd");
      expect(content).toContain("/code");
      expect(content).toContain("/review");
      expect(content).toContain("/triage");

      // Dual execution jurisdiction
      expect(content).toContain("In-Harness Shortcut");
      expect(content).toContain("Outer CLI Driver");
      expect(content).toContain("Context Rot");
    });
  });

  describe("2. Verifikasi Eksekusi Mandiri CLI /code (AC-D02-1)", () => {
    it("eksekusi mandiri 'ompimpa code D-02' berhasil jika SPEC-[ID].md ada (INV-09 lolos)", async () => {
      const res = await runCli(["code", "D-02"]);
      expect(res.code).toBe(0);
      const out = res.stdout + res.stderr;
      expect(out).toContain("Green-Phase Code Implementation");
      expect(out).toContain("Story: D-02");
      expect(out).toContain("INV-09 verified");
      expect(out).toContain("Circuit Breaker: Max 3 retry cycles");
      expect(out).toContain("ompimpa-ash");
      expect(out).toContain("Scoped Test Rule");
      expect(out).toContain("/review D-02");
    });

    it("eksekusi 'ompimpa code NONEXISTENT_STORY_XYZ' gagal cepat (INV-09 violation)", async () => {
      const res = await runCli(["code", "NONEXISTENT_STORY_XYZ"]);
      expect(res.code).toBe(1);
      const out = res.stdout + res.stderr;
      expect(out).toContain("Invariant Violation (INV-09)");
      expect(out).toContain("SPEC-NONEXISTENT_STORY_XYZ.md");
      expect(out).toContain("ompimpa story");
    });

    it("eksekusi 'ompimpa code' tanpa argumen menampilkan pesan error", async () => {
      const res = await runCli(["code"]);
      expect(res.code).toBe(1);
      const out = res.stdout + res.stderr;
      expect(out).toContain("Story ID is required");
    });
  });

  describe("3. Verifikasi Eksekusi Mandiri CLI /triage (AC-D02-1)", () => {
    it("eksekusi mandiri 'ompimpa triage' pada story tanpa review menghasilkan REMEDIATE (missing reviewers)", async () => {
      const res = await runCli(["triage", "D-02"]);
      expect(res.code).toBe(0); // non-strict exit 0
      const out = res.stdout + res.stderr;
      expect(out).toContain("Deterministic Triage (/triage D-02)");
      expect(out).toContain("Verdict: 🚫 REMEDIATE");
      expect(out).toContain("Missing Reviewer Panels");
      expect(out).toContain("Remediation Plan");
    });

    it("eksekusi mandiri dengan flag --strict gagal (exit 1) saat verdict REMEDIATE", async () => {
      const res = await runCli(["triage", "D-02", "--strict"]);
      expect(res.code).toBe(1);
    });

    it("eksekusi mandiri dengan flag --json menghasilkan struktur JSON valid", async () => {
      const res = await runCli(["triage", "D-02", "--json"]);
      expect(res.code).toBe(0);
      const parsed = JSON.parse(res.stdout);
      expect(parsed).toBeDefined();
      expect(parsed.score).toBeDefined();
      expect(parsed.score.verdict).toBe("REMEDIATE");
      expect(Array.isArray(parsed.missing)).toBeTrue();
      expect(Array.isArray(parsed.remediation)).toBeTrue();
    });

    it("eksekusi triage dalam lingkungan terisolasi dengan review 100% bersih menghasilkan PASS", async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-triage-clean-"));
      const reviewDir = path.join(tmpDir, "_ompimpa", "review");
      await fs.mkdir(reviewDir, { recursive: true });

      // Siapkan envelope review bersih (0 findings terverifikasi) untuk seluruh panel
      const panels = [
        "ompimpa-prd",
        "ompimpa-ironlaw",
        "ompimpa-security",
        "ompimpa-test",
        "ompimpa-verify",
        "ompimpa-ash",
        "ompimpa-liveview",
      ];
      for (const p of panels) {
        await fs.writeFile(
          path.join(reviewDir, `TEST-01-${p}.json`),
          JSON.stringify({ reviewer: p, story: "TEST-01", completedAt: "2026-09-08T00:00:00Z", findings: [] }),
          "utf-8"
        );
      }
      // Kontrak jujur: [] bersih hanya dengan marker sesi review completed.
      await fs.writeFile(
        path.join(reviewDir, "TEST-01.review.result.json"),
        JSON.stringify({ role: "review", story: "TEST-01", completed: true, files: panels.map((p) => `TEST-01-${p}.json`) }),
        "utf-8"
      );

      const res = await runCli(["triage", "TEST-01"], tmpDir);
      expect(res.code).toBe(0);
      const out = res.stdout + res.stderr;
      expect(out).toContain("Score: 100/100");
      expect(out).toContain("Verdict: ✅ PASS");
      expect(out).toContain("Zero findings");
      expect(out).toContain("done");

      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("eksekusi triage dalam lingkungan terisolasi dengan temuan duplikat melakukan deduplikasi hash file:line:ruleId", async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-triage-dedup-"));
      const reviewDir = path.join(tmpDir, "_ompimpa", "review");
      await fs.mkdir(reviewDir, { recursive: true });

      // Dua reviewer melaporkan pelanggaran yang sama di baris yang sama
      const finding = {
        file: "lib/wallet.ex",
        line: 42,
        ruleId: "01-no-float-money",
        severity: "Critical",
        message: "Penggunaan float dilarang",
        recommendation: "Ganti ke Decimal",
      };

      await fs.writeFile(path.join(reviewDir, `DEDUP-01-ompimpa-ironlaw.json`), JSON.stringify([finding]), "utf-8");
      await fs.writeFile(path.join(reviewDir, `DEDUP-01-ompimpa-security.json`), JSON.stringify([finding]), "utf-8");

      const res = await runCli(["triage", "DEDUP-01", "--json"], tmpDir);
      expect(res.code).toBe(0);
      const parsed = JSON.parse(res.stdout);

      // Raw findings 2, deduped 1
      expect(parsed.findings.length).toBe(2);
      expect(parsed.deduped.length).toBe(1);
      expect(parsed.deduped[0].merged_sources).toBe(2);
      expect(parsed.deduped[0].sources).toContain("ompimpa-ironlaw");
      expect(parsed.deduped[0].sources).toContain("ompimpa-security");

      // Score: 100 - 30 = 70 (penalti 1x, bukan 2x 60)
      expect(parsed.score.score).toBe(70);
      expect(parsed.score.p0Count).toBe(1);
      expect(parsed.score.verdict).toBe("REMEDIATE");

      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });

  describe("4. Verifikasi Bantuan CLI (ompimpa help)", () => {
    it("printHelp menampilkan daftar perintah modular: dev, code, triage, story", async () => {
      const res = await runCli(["help"]);
      expect(res.code).toBe(0);
      const out = res.stdout + res.stderr;
      expect(out).toContain("dev");
      expect(out).toContain("code");
      expect(out).toContain("triage");
      expect(out).toContain("story");
    });
  });
});
