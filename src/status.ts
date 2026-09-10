/**
 * Kanonis status lifecycle story OMP-IMPA (sumber kebenaran tunggal).
 *
 * Urutan maju (never-regress):
 *   backlog → ready-for-atdd → ready-for-dev → in-progress → in-review → done
 * Status terminal non-maju: failed, blocked.
 *
 * Pemetaan milestone (usulan Ketua Sidang):
 *   PRD disahkan       → daftarkan skeleton story `backlog` (+ tautan prd:)
 *   ADR disahkan       → `ready-for-atdd` (+ tautan adr:)
 *   SPEC JIT terbit    → tetap `ready-for-atdd` (gerbang INV-09 terpenuhi)
 *   ATDD merah selesai → `ready-for-dev`
 *   /code hijau        → `in-progress`
 *   /review dispatch   → `in-review`
 *   /triage PASS       → `done` (HANYA via triage --strict + gap-check)
 */

/** Urutan status maju kanonis (kebab-case). */
export const STATUS_ORDER = [
  "backlog",
  "ready-for-atdd",
  "ready-for-dev",
  "in-progress",
  "in-review",
  "done",
] as const;

export type StoryStatus = (typeof STATUS_ORDER)[number];

/** Status non-maju: terminal/gagal, bukan bagian urutan maju. */
export const NON_PROGRESS_STATUSES = ["failed", "blocked"] as const;

/** Status yang membuat outer loop terus berjalan (masih ada kerja). */
export const ACTIONABLE_STATUSES = [
  "backlog",
  "ready-for-atdd",
  "ready-for-dev",
  "in-progress",
  "in-review",
] as const;

/**
 * Normalisasi ejaan status: terima hyphen/underscore/case campuran,
 * kembalikan bentuk kebab-case kanonis. Status tak dikenal → apa adanya (lowercase, trim).
 */
export function normalizeStatus(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/_/g, "-");
  return s;
}

/** Index dalam STATUS_ORDER, atau -1 bila bukan status maju. */
export function statusRank(status: string): number {
  return STATUS_ORDER.indexOf(normalizeStatus(status) as StoryStatus);
}

/** True bila `next` berada tepat/sesudah `current` dalam urutan maju (never-regress). */
export function canAdvance(current: string, next: string): boolean {
  const from = statusRank(current);
  const to = statusRank(next);
  if (from === -1 || to === -1) return false;
  return to >= from;
}
/**
 * Write guard untuk updateFeatureStatus: tolak hanya regresi eksplisit di
 * dalam urutan maju (mis. done → in-progress). Status terminal/gagal
 * (failed, blocked) dan status tak dikenal selalu boleh ditulis.
 */
export function canWriteStatus(current: string, next: string): boolean {
  const from = statusRank(current);
  const to = statusRank(next);
  if (from === -1 || to === -1) return true;
  return to >= from;
}


/** True bila status masih membutuhkan kerja (loop lanjut). */
export function isActionable(status: string): boolean {
  return (ACTIONABLE_STATUSES as readonly string[]).includes(normalizeStatus(status));
}

/**
 * Milestone → status target. Dipakai command prd/adr/atdd/code/review/triage
 * agar transisi status disk selalu konsisten tanpa hafalan manual.
 */
export function statusForMilestone(
  milestone: "prd-approved" | "adr-approved" | "spec-ready" | "atdd-red" | "code-green" | "review-dispatched" | "triage-pass"
): StoryStatus {
  switch (milestone) {
    case "prd-approved":
      return "backlog";
    case "adr-approved":
    case "spec-ready":
      return "ready-for-atdd";
    case "atdd-red":
      return "ready-for-dev";
    case "code-green":
      return "in-progress";
    case "review-dispatched":
      return "in-review";
    case "triage-pass":
      return "done";
  }
}
