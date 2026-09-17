/**
 * Kanonis status lifecycle story OMP-IMPA (ADR-007 Two-Tier Paired State Machine).
 * Sumber kebenaran tunggal status eksekusi cerita.
 *
 * Urutan maju kanonis (never-regress order):
 *   backlog → in-story → ready-for-atdd → in-atdd → ready-for-dev → in-dev → ready-for-review → in-review → ready-for-triage → in-triage → done
 *
 * Siklus loopback remediasi (pasca-triage REMEDIATE):
 *   ready-for-patch → in-dev (loopback perbaikan terarah, tanpa mengulang story/atdd)
 *
 * Status terminal non-maju: failed, blocked.
 */

/** Urutan status maju kanonis (kebab-case). */
export const STATUS_ORDER = [
  "backlog",
  "in-story",
  "ready-for-atdd",
  "in-atdd",
  "ready-for-dev",
  "in-dev",
  "ready-for-review",
  "in-review",
  "ready-for-triage",
  "in-triage",
  "done",
] as const;

export type StoryStatus = (typeof STATUS_ORDER)[number];

/** Status non-maju: terminal/gagal, bukan bagian urutan maju. */
export const NON_PROGRESS_STATUSES = ["failed", "blocked"] as const;

/** Status loopback remediasi pasca-triage < 100. */
export const REMEDIATION_STATUSES = ["ready-for-patch", "remediating"] as const;

/** Status yang membuat outer loop terus berjalan (masih ada kerja aktif). */
export const ACTIONABLE_STATUSES = [
  "backlog",
  "in-story",
  "ready-for-atdd",
  "in-atdd",
  "ready-for-dev",
  "in-dev",
  "in-progress", // Alias legacy untuk in-dev
  "ready-for-review",
  "in-review",
  "ready-for-triage",
  "in-triage",
  "ready-for-patch",
  "remediating",
] as const;

/**
 * Metadata checkpoint untuk menjamin resumability tanpa denda token (ADR-007 §4.2).
 */
export interface CheckpointData {
  phase?: string;
  spec?: string;
  test_files?: string[];
  files_touched?: string[];
  review_artifacts?: string[];
  triage_verdict?: {
    score?: number;
    verdict?: string;
    blockers?: number;
    warnings?: number;
    summary?: string;
  };
  commit?: string | null;
}

/**
 * Normalisasi ejaan status: terima hyphen/underscore/case campuran,
 * petakan alias legacy (in-progress → in-dev).
 */
export function normalizeStatus(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/_/g, "-");
  if (s === "in-progress") return "in-dev";
  return s;
}

/** Index dalam STATUS_ORDER, atau -1 bila bukan status maju. */
export function statusRank(status: string): number {
  const norm = normalizeStatus(status);
  // ready-for-patch dan remediating berkedudukan setara dengan ready-for-dev/in-dev untuk loopback
  if (norm === "ready-for-patch" || norm === "remediating") {
    return STATUS_ORDER.indexOf("in-dev");
  }
  return STATUS_ORDER.indexOf(norm as StoryStatus);
}

/** True bila `next` berada tepat/sesudah `current` dalam urutan maju (never-regress). */
export function canAdvance(current: string, next: string): boolean {
  const from = statusRank(current);
  const to = statusRank(next);
  if (from === -1 || to === -1) return false;
  return to >= from;
}

/**
 * Write guard untuk updateFeatureStatus:
 * - Tolak regresi keluar dari status terminal `done` (INV-11: done adalah status permanen).
 * - Izinkan loopback remediasi sah: ready-for-triage/in-triage/ready-for-patch → in-dev.
 * - Tolak regresi mundur murni di dalam rantai maju.
 * - Status terminal/gagal (failed, blocked) selalu boleh ditulis.
 */
export function canWriteStatus(current: string, next: string): boolean {
  const curNorm = normalizeStatus(current);
  const nextNorm = normalizeStatus(next);

  if (curNorm === "done" && nextNorm !== "done") {
    // Status done pantang mundur
    return false;
  }

  // Izinkan loopback remediasi
  if (
    (curNorm === "in-triage" || curNorm === "ready-for-triage" || curNorm === "ready-for-patch") &&
    (nextNorm === "ready-for-patch" || nextNorm === "in-dev")
  ) {
    return true;
  }

  const from = statusRank(curNorm);
  const to = statusRank(nextNorm);
  if (from === -1 || to === -1) return true;
  return to >= from;
}

/** True bila status masih membutuhkan kerja (loop lanjut). */
export function isActionable(status: string): boolean {
  const norm = normalizeStatus(status);
  return (ACTIONABLE_STATUSES as readonly string[]).map((s) => normalizeStatus(s)).includes(norm);
}

/**
 * Milestone → status target (ADR-007 Paired States).
 */
export function statusForMilestone(
  milestone:
    | "prd-approved"
    | "adr-approved"
    | "spec-ready"
    | "atdd-red"
    | "code-green"
    | "review-dispatched"
    | "triage-pass"
    | "triage-remediate"
): StoryStatus | "ready-for-patch" {
  switch (milestone) {
    case "prd-approved":
      return "backlog";
    case "adr-approved":
    case "spec-ready":
      return "ready-for-atdd";
    case "atdd-red":
      return "ready-for-dev";
    case "code-green":
      return "ready-for-review";
    case "review-dispatched":
      return "in-review";
    case "triage-pass":
      return "done";
    case "triage-remediate":
      return "ready-for-patch";
  }
}
