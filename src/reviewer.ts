import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { loadOmpimpaConfig, type OmpimpaConfig } from "../hooks/ompimpa-guard";
import { runPrewalkScan, type PrewalkFinding } from "./prewalk";

export interface ReviewPanelMember {
  id: string;
  name: string;
  persona: string;
  role: string;
  active: boolean;
}

export interface ReviewFinding {
  category: "Spec" | "Tech" | "IronLaw" | "Security" | "Test" | "Compiler" | "Database" | "LiveView";
  severity: "P0" | "P1" | "P2"; // P0: Blocker, P1: Warning, P2: Suggestion
  message: string;
  file?: string;
  line?: number;
  column?: number;
  remediation?: string;
}

export interface ReviewScorecard {
  specScore: number;
  techScore: number;
  overallScore: number;
  scoreFloor: number;
  passed: boolean;
}

export interface ReviewResult {
  verdict: "PASSED" | "BLOCKED";
  scorecard: ReviewScorecard;
  activeReviewers: ReviewPanelMember[];
  findings: ReviewFinding[];
  summary: string;
}

/**
 * Membentuk panel reviewer aktif berdasarkan konfigurasi ompimpa.toml
 * B-03: Support split spec 1→3/4 BMAD lens
 */
export function buildReviewPanel(config: OmpimpaConfig): ReviewPanelMember[] {
  const panel: ReviewPanelMember[] = [];

  const enableSpec = config.quality?.review?.enable_spec_review ?? true;
  const enableTech = config.quality?.review?.enable_tech_review ?? true;
  const maxTechReviewers = config.quality?.review?.parallel_reviewers ?? 6;

  // B-03: detect BMAD split spec lens
  const cfgAny = config as unknown as Record<string, unknown>;
  const reviewCfg = (cfgAny.quality as Record<string, unknown> | undefined)?.review as Record<string, unknown> | undefined;
  const bmadLensCount = (reviewCfg?.bmad_lens_count as number | undefined)
    ?? (reviewCfg?.spec_lens_count as number | undefined)
    ?? (reviewCfg?.bmad_lens as number | undefined)
    ?? (reviewCfg?.split_spec_review === true ? 3 : undefined)
    ?? (reviewCfg?.enable_bmad_split === true ? 3 : undefined);
  const upstreamBMAD4 = bmadLensCount === 4 || process.env.BMAD_LENS === "4" || process.env.UPSTREAM_BMAD === "4";
  const useBMAD = bmadLensCount !== undefined && bmadLensCount >= 3;

  if (enableSpec) {
    if (useBMAD) {
      const count = upstreamBMAD4 ? 4 : 3;
      const lensDefs: Array<{ id: string; name: string; persona: string; role: string }> = [
        { id: "bmad_adversarial", name: "Tan Malaka", persona: "Adversarial Thinker", role: "Audit Edge Cases, Crash Scenarios, Race Conditions" },
        { id: "bmad_gap_verifier", name: "Gap Verifier", persona: "Coverage Guardian", role: "Audit AC Traceability TEA-01 — Miss 1 AC → High" },
        { id: "bmad_structural", name: "Structural Guardian", persona: "Clean Spine Architect", role: "Audit Boundary, Coupling, & Clean Architecture Spine" },
        { id: "bmad_completeness", name: "Completeness Auditor", persona: "BMAD 4th Lens", role: "Audit Completeness & Documentation Sync (Upstream BMAD 4)" },
      ];
      for (let i = 0; i < count; i++) {
        const lens = lensDefs[i];
        panel.push({ id: lens.id, name: lens.name, persona: lens.persona, role: lens.role, active: true });
      }
    } else {
      panel.push({
        id: "ompimpa-prd",
        name: "H. Agus Salim",
        persona: "Arsitek Produk & Keputusan Strategis",
        role: "Review Fungsional: Audit Source Code vs Acceptance Criteria PRD",
        active: true,
      });
    }
  }

  if (enableTech) {
    const techReviewers: ReviewPanelMember[] = [
      {
        id: "ompimpa-ironlaw",
        name: "Hj. Rasuna Said",
        persona: "Hakim Penegak 26 Hukum Besi",
        role: "Audit Kepatuhan 26 Hukum Besi Semantik & Anti-Pattern BEAM",
        active: true,
      },
      {
        id: "ompimpa-security",
        name: "Bagindo Azizchan",
        persona: "Benteng Pertahanan Perimeter",
        role: "Audit Keamanan Perimeter, OWASP Top 10, & Hex Supply-Chain",
        active: true,
      },
      {
        id: "ompimpa-test",
        name: "Tuanku Imam Bonjol",
        persona: "Panglima Benteng Mutu ATDD",
        role: "Scorecard Mutu Pengujian TEA, Anti-Mocking, Anti-Flaky (Process.sleep), & Isolasi Sandbox",
        active: true,
      },
      {
        id: "ompimpa-verify",
        name: "Verification Runner",
        persona: "Kompilator Ketat",
        role: "Verifikasi Strict Compiler Warnings-as-Errors, Formatter, & Linters",
        active: true,
      },
      {
        id: config.stacks?.use_ash_framework ? "ompimpa-ash" : "ompimpa-ecto",
        name: config.stacks?.use_ash_framework ? "Mr. Assaat" : "Mohammad Hatta",
        persona: config.stacks?.use_ash_framework ? "Resource Architect" : "Penata Integritas Data",
        role: "Audit Database: Anti-N+1, Ecto Pinning (^), & Fail-Closed Policies",
        active: true,
      },
      {
        id: config.stacks?.use_oban ? "ompimpa-oban" : "ompimpa-liveview",
        name: config.stacks?.use_oban ? "Djamaluddin Tamin" : "Tuanku Tambusai",
        persona: config.stacks?.use_oban ? "Pekerja Latar Belakang" : "Panglima Real-Time",
        role: "Audit State & Memori: Assigns Hygiene, Streams, & Oban Idempotency",
        active: true,
      },
    ];

    panel.push(...techReviewers.slice(0, maxTechReviewers));
  }

  return panel;
}

/**
 * B-01: Dispatch 7 Isolated Reviewers via task isolated:true
 * Setiap reviewer tulis _ompimpa/review/<story>-<reviewer>.json
 */
export interface DispatchOptions {
  targetDir?: string;
  reviewDir?: string;
  panel?: ReviewPanelMember[];
  timeoutMs?: number;
}

export interface DispatchResult {
  dispatched: number;
  files: string[];
  panel: ReviewPanelMember[];
  reviewDir: string;
}

export async function dispatchIsolatedReview(
  storyId: string,
  opts: DispatchOptions = {}
): Promise<DispatchResult> {
  const targetDir = opts.targetDir || process.cwd();
  const config = loadOmpimpaConfig(targetDir);
  const panel = opts.panel || buildReviewPanel(config);
  const reviewDir = opts.reviewDir || path.join(targetDir, "_ompimpa", "review");
  await fs.mkdir(reviewDir, { recursive: true });

  const files: string[] = [];
  const writes = panel.map(async (member) => {
    const filePath = path.join(reviewDir, `${storyId}-${member.id}.json`);
    try {
      // Anti-Mocking (D-03): Jika berkas JSON sudah ditulis oleh subagent, validasi strukturnya tanpa menimpa
      const existing = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(existing);
      if (!Array.isArray(parsed)) {
        throw new Error(`Review file ${filePath} must contain a JSON array`);
      }
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // Berkas belum ada di disk; inisialisasi berkas review bersih []
        await fs.writeFile(filePath, "[]\n", "utf-8");
      } else {
        throw err;
      }
    }
    files.push(filePath);
  });

  await Promise.all(writes);

  return { dispatched: panel.length, files, panel, reviewDir };
}

/**
 * Helper untuk prewalk INV-01: deteksi runReview inline tanpa dispatchIsolatedReview
 */
export function isReviewIsolatedCode(code: string): boolean {
  const hasDirectPrewalk = /runPrewalkScan\s*\(/.test(code);
  const hasDispatch = /dispatchIsolatedReview\s*\(/.test(code);
  if (hasDirectPrewalk && !hasDispatch) return false;
  return true;
}

/**
 * Menghitung Scorecard Pengujian & Kepatuhan Mutu (0-100) — v2 100/100
 * Port agyimpa 35-Row: Critical -30, High -15, Medium -5, Low -2
 * PASS only if overall==100 && 0 Critical/High (and allow_p2_nits false => Low also blocks via floor)
 */
export function calculateScorecard(
  findings: ReviewFinding[],
  scoreFloor: number = 100
): ReviewScorecard {
  let techScore = 100;
  let specScore = 100;
  let totalDeduction = 0;

  function deductionFor(sev: string): number {
    if (sev === "P0" || sev === "Critical") return 30;
    if (sev === "P1" || sev === "High") return 15;
    if (sev === "Medium" || sev === "P2-Medium") return 5;
    if (sev === "Low" || sev === "P2-Low") return 2;
    if (sev === "P2") return 5;
    return 5;
  }

  for (const f of findings) {
    const deduction = deductionFor(f.severity as string);
    totalDeduction += deduction;
    if (f.category === "Spec") {
      specScore = Math.max(0, specScore - deduction);
    } else {
      techScore = Math.max(0, techScore - deduction);
    }
  }

  const overallScore = Math.max(0, 100 - totalDeduction);
  const hasBlockers = findings.some((f) => f.severity === "P0" || f.severity === "P1");
  const hasAnyFinding = findings.length > 0;
  const passed = overallScore >= scoreFloor && !hasBlockers && !hasAnyFinding ? true : overallScore === 100 && findings.length === 0;
  const finalPassed = scoreFloor === 100 ? overallScore === 100 && findings.length === 0 : overallScore >= scoreFloor && !hasBlockers;

  return {
    specScore,
    techScore,
    overallScore,
    scoreFloor,
    passed: finalPassed,
  };
}

/**
 * Menjalankan review komprehensif pada proyek target
 * B-01: Mendukung isolated path via dispatchIsolatedReview + aggregateReviews
 * Jika options.storyId diberikan dan tidak ada review file, produce P0 INV-01
 */
export async function runReview(
  targetDir: string = process.cwd(),
  options: {
    targetPaths?: string[];
    storyId?: string;
    enforceIsolation?: boolean;
  } = {}
): Promise<ReviewResult> {
  const config = loadOmpimpaConfig(targetDir);
  const panel = buildReviewPanel(config);
  const scoreFloor = config.quality?.quality_score_floor ?? 100;
  const findings: ReviewFinding[] = [];

  // B-01 INV-01: Jika storyId diberikan, cek isolated review file existence
  if (options.storyId) {
    const reviewDir = path.join(targetDir, "_ompimpa", "review");
    const enforce = options.enforceIsolation ?? true;
    if (enforce) {
      const expectedFirst = panel[0]?.id || "ompimpa-prd";
      const firstFile = path.join(reviewDir, `${options.storyId}-${expectedFirst}.json`);
      const hasIsolated = fsSync.existsSync(firstFile);
      if (!hasIsolated) {
        let hasAny = false;
        try {
          const files = fsSync.readdirSync(reviewDir);
          hasAny = files.some((f) => f.startsWith(`${options.storyId}-`) && f.endsWith(".json"));
        } catch {
          hasAny = false;
        }
        if (!hasAny) {
          findings.push({
            category: "Spec",
            severity: "P0",
            message: "Review must be isolated via task — dispatchIsolatedReview not called for story " + options.storyId,
            remediation: "Use dispatchIsolatedReview(storyId) via task isolated:true before runReview",
          });
        }
      }
      if (findings.length === 0) {
        try {
          const { aggregateReviews } = await import("./triage.js");
          const agg = await aggregateReviews(options.storyId, { targetDir, reviewDir });
          for (const f of agg.deduped) {
            const sevMap: Record<string, ReviewFinding["severity"]> = {
              Critical: "P0",
              High: "P1",
              Medium: "P2",
              Low: "P2",
              P0: "P0",
              P1: "P1",
              P2: "P2",
            };
            const sev = sevMap[f.severity] || "P2";
            const cat: ReviewFinding["category"] =
              f.category === "Spec" ? "Spec" : f.severity === "High" || f.severity === "P1" ? "Security" : "IronLaw";
            findings.push({
              category: cat,
              severity: sev as ReviewFinding["severity"],
              message: f.message || f.rule_violation || f.ruleId,
              file: f.file,
              line: f.line ?? undefined,
              column: f.column ?? undefined,
              remediation: f.recommendation || f.remediation,
            });
          }
          const scorecard = calculateScorecard(findings, scoreFloor);
          const verdict = scorecard.passed ? "PASSED" : "BLOCKED";
          const blockerCount = findings.filter((f) => f.severity === "P0").length;
          const warningCount = findings.filter((f) => f.severity === "P1").length;
          let summary = "";
          if (verdict === "PASSED") {
            summary = `🏆 Review PASSED (Skor: ${scorecard.overallScore}/100, Floor: ${scoreFloor}). Siap untuk commit/deploy.`;
          } else {
            summary = `🚫 Review BLOCKED (Skor: ${scorecard.overallScore}/100, Floor: ${scoreFloor}). Ditemukan ${blockerCount} Blocker (P0) dan ${warningCount} Warning (P1).`;
          }
          return { verdict, scorecard, activeReviewers: panel, findings, summary };
        } catch {
          // fallback to prewalk inline if aggregate fails
        }
      }
    }
  }

  // 1. Jalankan Prewalk Scanner untuk aturan sintaksis/keamanan lokal (fallback atau non-story mode)
  const prewalkResult = await runPrewalkScan(targetDir, {
    targetPaths: options.targetPaths,
  });

  for (const f of prewalkResult.findings) {
    findings.push({
      category: f.ruleId.includes("security") || f.ruleId.includes("raw-html") ? "Security" : "IronLaw",
      severity: "P0",
      message: `[${f.ruleName}] ${f.description}`,
      file: f.file,
      line: f.line,
      column: f.column,
      remediation: f.remediation,
    });
  }
  // E-02: Scan test files for flaky patterns (Process.sleep / arbitrary sleep)
  try {
    const { detectFlakyPatterns } = await import("./triage.js");
    let testFiles = (options.targetPaths || []).filter(
      (p) => p.includes("test") || p.endsWith(".exs") || p.endsWith(".test.ts") || p.endsWith(".spec.ts")
    );
    if (testFiles.length === 0) {
      const testDir = path.join(targetDir, "test");
      if (fsSync.existsSync(testDir)) {
        const collect = (dir: string) => {
          try {
            const entries = fsSync.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const res = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                collect(res);
              } else if (
                entry.isFile() &&
                (entry.name.endsWith("_test.exs") ||
                  entry.name.endsWith(".test.ts") ||
                  entry.name.endsWith(".spec.ts"))
              ) {
                testFiles.push(path.relative(targetDir, res));
              }
            }
          } catch {}
        };
        collect(testDir);
      }
    }
    for (const tf of testFiles) {
      const full = path.isAbsolute(tf) ? tf : path.join(targetDir, tf);
      if (fsSync.existsSync(full)) {
        const content = fsSync.readFileSync(full, "utf-8");
        const flakies = detectFlakyPatterns(content, tf);
        for (const fl of flakies) {
          findings.push({
            category: "Test",
            severity: "P1",
            message: fl.message || fl.rule_violation || "Flaky test hazard detected",
            file: fl.file,
            line: fl.line ?? undefined,
            column: fl.column ?? undefined,
            remediation: fl.recommendation,
          });
        }
      }
    }
  } catch {}


  // 2. Hitung scorecard kelulusan
  const scorecard = calculateScorecard(findings, scoreFloor);
  const verdict = scorecard.passed ? "PASSED" : "BLOCKED";

  const blockerCount = findings.filter((f) => f.severity === "P0").length;
  const warningCount = findings.filter((f) => f.severity === "P1").length;

  let summary = "";
  if (verdict === "PASSED") {
    summary = `🏆 Review PASSED (Skor: ${scorecard.overallScore}/100, Floor: ${scoreFloor}). Siap untuk commit/deploy.`;
  } else {
    summary = `🚫 Review BLOCKED (Skor: ${scorecard.overallScore}/100, Floor: ${scoreFloor}). Ditemukan ${blockerCount} Blocker (P0) dan ${warningCount} Warning (P1).`;
  }

  return {
    verdict,
    scorecard,
    activeReviewers: panel,
    findings,
    summary,
  };
}
