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
 */
export function buildReviewPanel(config: OmpimpaConfig): ReviewPanelMember[] {
  const panel: ReviewPanelMember[] = [];

  const enableSpec = config.quality?.review?.enable_spec_review ?? true;
  const enableTech = config.quality?.review?.enable_tech_review ?? true;
  const maxTechReviewers = config.quality?.review?.parallel_reviewers ?? 6;

  if (enableSpec) {
    panel.push({
      id: "ompimpa-prd",
      name: "H. Agus Salim",
      persona: "Arsitek Produk & Keputusan Strategis",
      role: "Review Fungsional: Audit Source Code vs Acceptance Criteria PRD",
      active: true,
    });
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
        role: "Scorecard Mutu Pengujian TEA, Anti-Mocking, & Isolasi Sandbox",
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
 * Menghitung Scorecard Pengujian & Kepatuhan Mutu (0-100)
 */
export function calculateScorecard(
  findings: ReviewFinding[],
  scoreFloor: number = 90
): ReviewScorecard {
  let techScore = 100;
  let specScore = 100;

  for (const f of findings) {
    const deduction = f.severity === "P0" ? 25 : f.severity === "P1" ? 10 : 3;
    if (f.category === "Spec") {
      specScore = Math.max(0, specScore - deduction);
    } else {
      techScore = Math.max(0, techScore - deduction);
    }
  }

  // Bobot: 40% Spec Review, 60% Tech Review
  const overallScore = Math.round(specScore * 0.4 + techScore * 0.6);
  const hasBlockers = findings.some((f) => f.severity === "P0");
  const passed = overallScore >= scoreFloor && !hasBlockers;

  return {
    specScore,
    techScore,
    overallScore,
    scoreFloor,
    passed,
  };
}

/**
 * Menjalankan review komprehensif pada proyek target
 */
export async function runReview(
  targetDir: string = process.cwd(),
  options: {
    targetPaths?: string[];
  } = {}
): Promise<ReviewResult> {
  const config = loadOmpimpaConfig(targetDir);
  const panel = buildReviewPanel(config);
  const scoreFloor = config.quality?.quality_score_floor ?? 90;
  const findings: ReviewFinding[] = [];

  // 1. Jalankan Prewalk Scanner untuk aturan sintaksis/keamanan lokal
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
