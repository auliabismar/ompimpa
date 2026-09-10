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

export function buildReviewPrompt(input: ReviewPromptInput): string {
  return [
    `Kamu adalah koordinator review OMP-IMPA untuk story ${input.story.id}: ${input.story.title}. SESI INI READ-ONLY terhadap kode produksi dan test — dilarang mengubah file apa pun kecuali berkas review di ${input.reviewDirRel}/.`,
    ``,
    `Spesifikasi acuan: ${input.specRel}`,
    `Berkas yang diaudit (hanya ini): ${[...input.targetFiles, ...input.testFiles].join(", ")}`,
    ``,
    `TUGAS: fan-out via tool task ke ${input.reviewerIds.length} subagent reviewer, satu per ID berikut: ${input.reviewerIds.join(", ")}.`,
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
  ].join("\n");
}
