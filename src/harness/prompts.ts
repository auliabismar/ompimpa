/**
 * Prompt kontrak sesi harness. Setiap prompt mendefinisikan: tujuan, kurungan
 * berkas, larangan, perintah verifikasi, dan marker penyelesaian yang WAJIB
 * ditulis sesi sebagai aksi terakhir. Adapter tidak percaya apa pun selain
 * artefak disk + marker.
 */

import type { StoryDetail } from "../story_spec";

export interface DevPromptInput {
  story: StoryDetail;
  /** Relatif terhadap targetDir, mis. `_ompimpa/specs/SPEC-19-2.md`. */
  specRel: string;
  targetFiles: string[];
  testFiles: string[];
  /** Perintah scoped test, mis. `mix test test/..._test.exs --include atdd`. */
  scopedTest: string;
  /** Relatif terhadap targetDir. */
  markerRel: string;
  /** Temuan perbaikan dari triage putaran sebelumnya (jika retry / loopback). */
  remediationFindings?: string[];
}

export function buildDevPrompt(input: DevPromptInput): string {
  const acList = input.story.ac
    .map((ac) => `- ${ac.id}: Given ${ac.given} When ${ac.when} Then ${ac.then}`)
    .join("\n");
  return [
    `Kamu adalah spesialis implementasi OMP-IMPA untuk story ${input.story.id}: ${input.story.title}.`,
    ``,
    `KONTRAK MIKRO (baca penuh, jangan ubah): ${input.specRel}`,
    `Kriteria penerimaan:`,
    acList,
    ``,
    `TUGAS, berurutan:`,
    `1. Untuk tiap file di [${input.testFiles.join(", ")}]: ganti stub flunk() menjadi asersi substantif yang benar-benar mengeksekusi perilaku AC di atas.`,
    `2. Jalankan ${input.scopedTest} — WAJIB tunjukkan MERAH dulu (failing) sebelum menulis kode produksi.`,
    `3. Implementasikan kode HANYA di [${input.targetFiles.join(", ")}] sampai perintah scoped test di atas HIJAU (exit 0).`,
    ...(input.remediationFindings && input.remediationFindings.length > 0
      ? [
          ``,
          `TEMUAN PERBAIKAN MUTU DARI TRIAGE SEBELUMNYA (WAJIB DISELESAIKAN):`,
          `Triage putaran sebelumnya gagal. Kamu WAJIB menyelesaikan seluruh temuan di bawah ini agar story dapat lulus 100/100:`,
          ...input.remediationFindings.map((f) => `• ${f}`),
          `Kamu diizinkan menyentuh dan memperbaiki file yang disebutkan dalam temuan perbaikan di atas selain daftar target awal.`,
        ]
      : []),
    ``,
    `LARANGAN (pelanggaran = sesi gagal):`,
    `- Dilarang mengubah blok intent beku di SPEC.`,
    `- Dilarang menyentuh file di luar daftar target/test di atas dan file yang disebutkan dalam temuan perbaikan.`,
    `- Dilarang MENULIS ke _ompimpa/status/ dalam bentuk apa pun (status milik orchestrator; sesi yang menandai story done sendiri = gagal).`,
    `- Dilarang MENULIS ke _ompimpa/review/ (milik sesi review). Tulis HANYA file target, file test, dan marker.`,
    `- Dilarang menjalankan perintah ompimpa dalam bentuk apa pun (story/atdd/code/review/triage/dev) — orkestrasi milik loop, bukan sesi.`,
    `- Dilarang git commit (commit dilakukan orchestrator setelah triage PASS).`,
    `- Dilarang menjalankan full test suite; hanya perintah scoped test di atas.`,
    `- Dilarang menandai selesai bila scoped test belum hijau.`,
    ``,
    `PENYELESAIAN (aksi terakhir, wajib): tulis file ${input.markerRel} berisi JSON persis:`,
    `{"role":"dev","story":"${input.story.id}","completed":true,"tests":{"argv":["sesuai perintah scoped test dipecah per argumen"],"exit":0},"files_touched":["..."]}`,
  ].join("\n");
}

export interface ReviewPromptInput {
  story: StoryDetail;
  specRel: string;
  targetFiles: string[];
  testFiles: string[];
  /** Relatif terhadap targetDir, mis. `_ompimpa/review`. */
  reviewDirRel: string;
  reviewerIds: string[];
  /** Relatif terhadap targetDir. */
  markerRel: string;
}
/** R4: batch fan-out — spec lens dulu (ringan, cepat), tech panel menyusul. */
export interface ReviewBatch {
  name: string;
  reviewerIds: string[];
}

export function partitionReviewBatches(reviewerIds: string[]): ReviewBatch[] {
  const spec = reviewerIds.filter((id) => id.startsWith("bmad_") || id === "ompimpa-prd");
  const tech = reviewerIds.filter((id) => !(id.startsWith("bmad_") || id === "ompimpa-prd"));
  if (spec.length === 0 || tech.length === 0) return [{ name: "panel", reviewerIds }];
  return [
    { name: "spec", reviewerIds: spec },
    { name: "tech", reviewerIds: tech },
  ];
}


const REVIEWER_AGENT_BY_ID: Record<string, string> = {
  bmad_adversarial: "ompimpa-triz",
  bmad_gap_verifier: "scout",
  bmad_structural: "scout",
  bmad_completeness: "scout",
  "ompimpa-prd": "ompimpa-prd",
  "ompimpa-ironlaw": "ompimpa-ironlaw",
  "ompimpa-security": "ompimpa-security",
  "ompimpa-test": "ompimpa-test",
  "ompimpa-verify": "ompimpa-verify",
  "ompimpa-ash": "ompimpa-ash",
  "ompimpa-ecto": "ompimpa-ecto",
  "ompimpa-liveview": "ompimpa-liveview",
  "ompimpa-oban": "ompimpa-oban",
};

/** INVARIANT: tiap reviewer-id terikat ke agent nyata; dilarang memakai agent generik "task". */
export function reviewAgentFor(reviewerId: string): string {
  return REVIEWER_AGENT_BY_ID[reviewerId] || "scout";
}

export function buildReviewPrompt(input: ReviewPromptInput): string {
  const assignments = input.reviewerIds.map((id) => `- ${id} → agent "${reviewAgentFor(id)}"`).join("\n");
  const batches = partitionReviewBatches(input.reviewerIds);
  const batchPlan = batches.map((b, i) => `GELOMBANG ${i + 1}/${batches.length} (${b.name}, ${b.reviewerIds.length} reviewer): ${b.reviewerIds.join(", ")}`).join("\n");
  return [
    `Kamu adalah koordinator review OMP-IMPA untuk story ${input.story.id}: ${input.story.title}. SESI INI READ-ONLY terhadap kode produksi dan test — dilarang mengubah file apa pun kecuali berkas review di ${input.reviewDirRel}/.`,
    ``,
    `Spesifikasi acuan: ${input.specRel}`,
    `Berkas yang diaudit (hanya ini): ${[...input.targetFiles, ...input.testFiles].join(", ")}`,
    ``,
    `TUGAS: fan-out via tool task per GELOMBANG berurutan (selesaikan gelombang 1 + tulis file-nya SEBELUM membuka gelombang 2) memakai pasangan TETAP berikut (dilarang memakai agent generik "task"):`,
    assignments,
    `RENCANA GELOMBANG:`,
    batchPlan,
    `Tiap subagent membaca berkas audit secara independen lalu MENULIS file ${input.reviewDirRel}/${input.story.id}-<reviewer-id>.json dengan format ENVELOPE persis (bukan bare array):`,
    `{"reviewer":"<reviewer-id>","story":"${input.story.id}","completedAt":"<ISO-8601>","findings":[...]}`,
    `Tiap temuan WAJIB berbentuk: {"severity":"P0|P1|P2","file":"...","line":N,"ruleId":"...","message":"...","recommendation":"...","verdict":"high|medium|low|false|maybe-false","evidence":"satu-dua kalimat bukti dari kode"}.`,
    `Aturan verdict (wajib): verifikasi klaim di kode melampaui diff (ikuti caller/guard); false = klaim terbukti tidak terjadi + tulis disproof; severity dari harm nyata, abaikan severity awal bila konteks membuktikan lain; dilarang drop/merge diam-diam.`,
    `Hasil kosong ditulis {"reviewer":"<id>","story":"${input.story.id}","completedAt":"...","findings":[]} — array kosong HANYA sah di dalam envelope terverifikasi; bare [] berarti tidak direview.`,
    ``,
    `LARANGAN (pelanggaran = sesi gagal): mengubah kode/test; mensintesis temuan tanpa membaca kode; menulis [] tanpa verifikasi; MENULIS ke _ompimpa/status/ atau SPEC (status milik orchestrator; ledger ditulis orchestrator); menjalankan perintah ompimpa dalam bentuk apa pun (men-generate SPEC story lain, menjalankan fase loop) — orkestrasi milik loop, bukan sesi.`,
    ``,
    `PENYELESAIAN (aksi terakhir, wajib): tulis file ${input.markerRel} berisi JSON persis:`,
    `{"role":"review","story":"${input.story.id}","completed":true,"files":["${input.story.id}-<id>.json", "..."]}`,
    `BATAS WAKTU (wajib): sisakan menit terakhir sesi untuk menulis marker — agregasi file yang SUDAH selesai dan tulis marker parsial (hanya file yang ada), jangan menunggu reviewer yang tak kunjung kembali hingga sesi dibunuh.`,
  ].join("\n");
}

export interface CommitPromptInput {
  story: StoryDetail;
  specRel?: string;
  targetFiles?: string[];
  diffStat: string;
  nameStatus: string;
  diffSnippet: string;
  markerRel: string;
}

export function buildCommitPrompt(input: CommitPromptInput): string {
  const acList = (input.story.ac || [])
    .map((ac) => `- ${ac.id}: Given ${ac.given} When ${ac.when} Then ${ac.then}`)
    .join("\n");

  return [
    `Kamu adalah agen spesialis ompimpa-commit (model smol).`,
    `TUGAS: Analisis perubahan kode pada git staged diff di bawah dan hasilkan PESAN COMMIT SEMANTIK (Conventional Commit) yang akurat dan deskriptif.`,
    ``,
    `METADATA CERITA:`,
    `- Story ID: ${input.story.id}`,
    `- Judul: ${input.story.title}`,
    `- Epic: ${input.story.epic || ""}`,
    ...(acList ? [`Kriteria Penerimaan:`, acList] : []),
    ``,
    `RINGKASAN PERUBAHAN FILE (git diff --stat):`,
    input.diffStat,
    ``,
    `STATUS FILE (git diff --name-status):`,
    input.nameStatus,
    ``,
    `POTONGAN PERUBAHAN DIFF:`,
    input.diffSnippet,
    ``,
    `ATURAN FORMAT PESAN COMMIT (WAJIB):`,
    `1. Header Conventional Commit: <type>(<scope>): <ringkasan singkat imperative> (${input.story.id})`,
    `   - <type>: feat | fix | refactor | test | docs | perf`,
    `   - <scope>: modul/domain spesifik dari file yang disentuh (misal: form, liveview, admin, finance, auth, ui)`,
    `   - <ringkasan>: huruf kecil di awal, padat, tanpa titik di akhir baris header`,
    `2. Baris kosong setelah header`,
    `3. Body berupa poin-poin (- ) yang merinci perubahan konkret berdasarkan file nyata yang dimodifikasi, komponen yang ditambah/diubah/dihapus, dan perilaku baru sesuai AC`,
    `4. Poin penutup menyertakan:`,
    `   - Story: ${input.story.id}`,
    ...(input.story.epic ? [`   - Epic: ${input.story.epic}`] : []),
    `   - Quality: Triage 100/100 PASS (TEA Architecture)`,
    ``,
    `PENYELESAIAN (aksi terakhir, wajib): tulis file ${input.markerRel} berisi JSON persis:`,
    `{"role":"commit","story":"${input.story.id}","completed":true,"commitMessage":"<pesan commit lengkap yang sudah diformat di atas>"}`,
  ].join("\n");
}
