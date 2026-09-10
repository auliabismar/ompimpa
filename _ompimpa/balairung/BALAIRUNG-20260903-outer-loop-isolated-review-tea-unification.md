# Risalah Mufakat Balairung Sari — Outer Loop, Isolated Review 10, Dekomposisi Fase Rekayasa, & Unifikasi Inspeksi

> **Sidang:** Balairung Sari — Musyawarah Meja Bundar Interaktif (*Party Mode*)  
> **Tanggal & Waktu:** 2026-09-03  
> **ID Sidang:** BALAIRUNG-20260903-outer-loop-isolated-review-tea-unification  
> **Ketua Sidang:** Pimpinan Majelis (Pengguna)  
> **Dewan Hadir:** Tan Malaka (`ompimpa-triz`), H. Agus Salim (`ompimpa-prd`), Hj. Rasuna Said (`ompimpa-ironlaw`), Sutan Sjahrir (`ompimpa-otp`), Tuanku Imam Bonjol (`ompimpa-test`), Bung Hatta (`ompimpa-ecto`), Djamaluddin Adinegoro (`ompimpa-debug`), Marah Rusli (`ompimpa-ui`)  
> **Status:** **Mufakat Bulat Diketuk — Sidang Resmi Ditutup**  
> **Artefak Terkait:** `_ompimpa/adr/ADR-001-panen-agyimpa-isolated-review-criteria-registry.md`, `_ompimpa/stories.yaml`, `_ompimpa/criteria_registry_35.json`, `templates/ompimpa.toml`

---

## 1. Topik Musyawarah & Konteks Keputusan

Sidang dibuka untuk menuntaskan ambiguitas mendasar antara **kontrak spesifikasi** dan **realisasi kode sumber** di OMP-IMPA terkait:
1. **Status Implementasi Review:** Apakah review di `src/reviewer.ts` berstatus *isolated* sejati, sebagian, atau *inline*?
2. **Komparasi Upstream BMAD (`bmad-loop`):** Mengapa BMAD mewajibkan subagent terisolasi dan bagaimana OMP-IMPA mengadopsi loop *Zero-Gap* tanpa mengimpor cangkang TUI dan kelemahan subprocess yang rapuh?
3. **Utilitas Graphify:** Apakah pemetaan graf dependensi berbasis MCP server membantu kecepatan atau bentuk *overthinking*?
4. **Cara Kerja `ompimpa dev --epic`:** Bedah baris kode sumber `src/cli.ts:882-980` dan nasib eksekusi sekuensial story.
5. **Dekomposisi Fase Rekayasa:** Pemecahan monolit `/dev` menjadi fase mandiri (`/story` → `/atdd` → `/code` → `/review` → `/triage`) serta alokasi model bertingkat (*Model Tiering*).
6. **Pematangan Bertahap Spesifikasi (Progressive Elaboration):** Evaluasi kedalaman spesifikasi (3 tingkat: PRD Makro → Stories DAG → Story Spec JIT).
7. **Panen Lanjutan BMAD-TEA:** Penentuan yurisdiksi 3 instrumen pengujian (Traceability TEA-01, Flaky Hunter, Assertion Mutation Guard).
8. **Unifikasi Diagnostic Out-of-Band:** Penyatuan perintah `audit`, `boundaries`, `perf`, dan `techdebt` menjadi satu perintah master: `/ompimpa:inspect`.

---

## 2. Risalah Ronde 1: Posisi Awal Independen Dewan

1. **Tan Malaka (`ompimpa-triz`):**
   - `[FACT]` Di BMAD, antitesis review wajib independen secara dialektis.
   - `[FACT]` Di `src/reviewer.ts`, saat ini eksekusi scanner masih memanggil `runPrewalkScan()` inline lalu membagi hasilnya ke file JSON disk. Ini adalah simulasi isolasi demi memenuhi kontrak file.
   - `[INFERENCE]` Reviewer tanpa nalar LLM (hanya regex) meloloskan 100% cacat semantik (AC drift, race condition, asersi bodong).

2. **H. Agus Salim (`ompimpa-prd`):**
   - `[FACT]` Spesifikasi Gherkin tidak bisa divalidasi oleh pencocokan teks kaku (*lexical pattern*).
   - `[INFERENCE]` Biaya token API dan latensi 30–60 detik per story adalah premi asuransi wajib demi mencegah bug fatal di produksi.

3. **Hj. Rasuna Said (`ompimpa-ironlaw`):**
   - `[FACT]` `commands/dev.md:33` menetapkan INV-01: *"Review WAJIB di-dispatch melalui subagent terisolasi via tool task"*.
   - `[FACT]` Penegakan hukum isolasi tidak boleh dikompromikan oleh kecepatan unit test `bun test` 300ms yang menguji mock data kosong.

4. **Sutan Sjahrir (`ompimpa-otp`):**
   - `[FACT]` Ada batas arsitektur tegas antara Bun CLI lokal (offline/deterministik) dan OMP Agent Harness (interaktif/AI).
   - `[INFERENCE]` Menjalankan loop otonom panjang di dalam 1 sesi chat AI memicu *Context Rot* (>100k token). Outer Runner di level OS terminal dengan *ephemeral process* adalah pola OTP yang paling bersih.

---

## 3. Risalah Ronde 2: Dialektika, Debat Silang, & Bedah Kode Sumber

### A. Bedah Kode `src/reviewer.ts` & Panel 10 Reviewer
- Dewan membuktikan secara faktual bahwa konfigurasi `ompimpa.toml` (`bmad_lens_count = 4`) menghasilkan **10 Reviewer Lengkap (4 BMAD Spec + 6 phxagents Tech)**.
- Namun di dalam `dispatchIsolatedReview()`, temuan `ironlaw` dan `security` berasal dari filter inline `runPrewalkScan`, sementara 8 reviewer lainnya menulis array kosong `[]`.
- **Keputusan Ketua Sidang:** Celah *spec-reality gap* ini wajib ditutup. Mocking inline dihapus; 10 file JSON wajib diisi murni oleh 10 subagent AI independen.

### B. Dialektika Graphify: MCP vs Lazy Xref
- Test `test/graphify.test.ts` mencatat `buildGraph()` memakan waktu 2.455ms (>2s budget).
- Dewan menyepakati bahwa mengangkat Graphify menjadi **server MCP tersendiri adalah OVERTHINK & BLOAT**.
- Solusi mufakat: Graphify dijadikan **aturan scoping cerdas (Lazy Xref)**:
  - Leaf file / Web UI: lewati graphify, langsung review diff lokal.
  - Core Context / Skema DB: jalankan `mix xref callers` kilat untuk menyuapi daftar file blast-radius ke subagent review.

### C. Bedah Kode `handleDev` (`src/cli.ts:882-980`)
- Kode saat ini sukses memvalidasi DAG (Kahn's algorithm), mendeteksi siklus, dan mengecek blocker.
- Namun pada baris 979, fungsi langsung melakukan **`return;`** tanpa koding nyata.
- Mufakat: `bin/ompimpa dev --epic` diangkat menjadi **Outer Loop Driver** yang mengeksekusi subprocess OMP per-fase hingga mencapai 100/100 Zero-Gap.

### D. Refleksi TUI BMAD-Loop & Pemanfaatan Primitif `hub`
- Ketua Sidang membagikan pengalaman nyata: TUI di BMAD dibuat untuk bottom-bar wrapper, pemantauan read-only, dan mekanisme *attach* intervensi. Namun di lapangan, wrapper PTY sering hang saat harness tersedak.
- Dewan menyepakati: OMP-IMPA **menolak cangkang TUI eksternal yang rapuh**, dan menggantinya dengan:
  1. Primitif **`hub` OMP** (`op: "start"`, `detached: true`, `logs`, `send`) untuk background execution jika diperlukan.
  2. Watchdog timeout terikat (60s) di level subagent.
  3. Status HUD ringkas di layar terminal tanpa manipulasi curses.

---

## 4. Keputusan Akhir & Mufakat (The Verdict)

Sidang Balairung Sari memutuskan **8 Butir Kesepakatan Mufakat Bulat**:

### 1. Penegakan 10 Subagent Isolated Review Sejati
- Menolak simulasi inline di `src/reviewer.ts:dispatchIsolatedReview`.
- Review wajib di-dispatch via batch tool `task(tasks=[...], isolated=true)` ke 10 subagent paralel:
  - **4 BMAD Spec Lens:** `bmad_adversarial` (Tan Malaka), `bmad_gap_verifier`, `bmad_structural`, `bmad_completeness`.
  - **6 phxagents Tech Panel:** `ompimpa-ironlaw` (Rasuna Said), `ompimpa-security` (Azizchan), `ompimpa-test` (Imam Bonjol), `ompimpa-verify`, `ompimpa-ash/ecto` (Assaat/Hatta), `ompimpa-liveview/oban` (Tambusai/Tamin).
- Masing-masing menulis laporan independen ke `_ompimpa/review/<storyId>-<reviewerId>.json`.

### 2. Eliminasi MCP Graphify → Lazy Xref Scoping
- Membatalkan pembuatan MCP Server Graphify terpisah.
- Mengadopsi *Lazy Blast-Radius Scoping*: `mix xref callers` hanya dipanggil jika modul konteks inti/skema database diubah.

### 3. Pemisahan Yurisdiksi Outer CLI vs In-Harness Command
- **`bin/ompimpa dev --epic <ID> --auto` (Outer CLI di Terminal):** Bertindak sebagai *Master Batch Orchestrator* yang mengendalikan while-loop antar-story, commit git, dan transisi status disk dengan context window bersih per langkah.
- **`/ompimpa:dev --story <ID>` (Di Dalam Sesi OMP):** Disederhanakan menjadi *Interactive Single-Story Shortcut* untuk kenyamanan developer di dalam chat.

### 4. Dekomposisi Fase Rekayasa Menjadi Perintah Mandiri
Monolit `/dev` dipecah menjadi 5 perintah atomik yang dapat dipanggil mandiri maupun dirangkai otomatis:
1. **`/ompimpa:story <ID>`**: Menyiapkan dokumen spesifikasi mikro just-in-time.
2. **`/atdd <ID>`**: Scaffolding tes merah (Tuanku Imam Bonjol).
3. **`/code <ID>`**: Implementasi kode produksi hingga tes hijau (Spesialis Stack).
4. **`/review <ID>`**: Eksekusi 10 subagent isolated review paralel.
5. **`/triage <ID>`**: Deduplikasi hash `file:line:ruleId` & kalkulasi scorecard 100/100 (`src/triage.ts`).

### 5. Model Tiering Dinamis Berbasis Beban Kognitif
Mengoptimalkan konfigurasi `[models]` di `ompimpa.toml` per fase dan per subagent:
- Model **`smol`** (murah & kilat): `ironlaw`, `verify`, `commit`.
- Model **`slow`** (penalaran mendalam): `security`, `adversarial`, `balairung`.
- Model **`default`**: `dev` koding, `test` ATDD, `structural`, `gap_verifier`.
- Model **Deterministic TS (0 token)**: `triage.ts` dedup hash & kalkulasi skor.

### 6. Pematangan Bertahap Spesifikasi (3-Tingkat BMAD)
- **Tingkat 1 (Analisis):** Master PRD Makro (`_ompimpa/prd/PRD-[ID].md`) — fokus ruang masalah dan boundary bisnis.
- **Tingkat 2 (Solutioning):** Stories DAG (`_ompimpa/stories.yaml`) & MADR (`_ompimpa/adr/`) — fokus arsitektur dan ketergantungan.
- **Tingkat 3 (Implementasi JIT):** Story Spec Mikro (`_ompimpa/specs/SPEC-[ID].md`) — diterbitkan sesaat sebelum `/atdd` untuk memuat Gherkin presisi, signature fungsi, dan skema data riil.

### 7. Yurisdiksi In-Band untuk 3 Instrumen BMAD-TEA
Ketiga instrumen TEA ditetapkan beroperasi **IN-BAND (di dalam loop per-story)**:
1. **Traceability Matrix (TEA-01):** Dicipta di `/atdd`, diaudit di `/review` (`bmad_gap_verifier`), divonis di `/triage` (Miss 1 AC = High Finding, BLOCKED).
2. **Flaky & Latency Hunter:** Diaudit di `/review` (`ompimpa-test` & `verify`) — melarang `Process.sleep` dan membatasi tes in-process <50ms.
3. **Assertion Mutation Guard:** Diaudit di `/review` (`ompimpa-test`) — melarang asersi longgar/formalitas demi mencegah *false greens*.

### 8. Unifikasi Master Diagnostic Out-of-Band: `/ompimpa:inspect`
- Menyatukan `audit`, `boundaries`, `perf`, dan `techdebt` menjadi satu perintah master: **`/ompimpa:inspect`**.
- Beroperasi *out-of-band* (di luar siklus story) untuk mengaudit seluruh codebase.
- Output pemindaian otomatis diolah oleh `src/triage.ts`:
  - Temuan P0/P1 otomatis diterbitkan menjadi **`EPIC-DEBT` baru di `_ompimpa/stories.yaml`**.
  - Temuan P2 dicatat ke `_ompimpa/deferred.md` untuk disapu berkala via `ompimpa sweep`.

---

## 5. Dissenting Opinions & Preserved Nuances

- **Tan Malaka (`ompimpa-triz`):** Mengingatkan agar saat outer CLI runner diimplementasikan di Bun, jangan pernah membuat ulang dependensi PTY yang kompleks seperti upstream Python. Gunakan spawning subprocess standar yang mengalirkan stdout/stderr secara transparan.
- **Tuanku Imam Bonjol (`ompimpa-test`):** Menegaskan bahwa toleransi TEA Scorecard tetap mutlak: skor minimum lolos adalah **100/100** (dengan 0 Blocker, 0 High, dan 0 Medium) untuk story produksi baru.

---

## 6. Kill Criteria (Batas Pembatalan Keputusan)

1. **Latensi Review:** Jika pemanggilan paralel 10 subagent di `/review` memakan waktu >90 detik secara konsisten, dewan wajib bersidang kembali untuk mengelompokkan 6 tech reviewer menjadi 3 grup gabungan.
2. **Kerapuhan Subprocess:** Jika outer CLI runner mengalami *broken pipe* atau *hung process* pada lingkungan Windows/WSL, eksekusi wajib dialihkan sepenuhnya ke in-harness orchestrator dengan pengawalan hook `session_stop`.

---

## 7. Rekomendasi Tindak Lanjut Konkret (Action Plan)

Dewan merekomendasikan **5 langkah rekayasa berurutan**:

- [ ] **Langkah 1 (ADR):** Terbitkan **`ADR-002`** (`_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md`) yang mengadopsi hasil sidang ini ke standar MADR 3.0+.
- [ ] **Langkah 2 (Commands & Specs):**
  - Buat berkas perintah baru: `commands/story.md`, `commands/code.md`, `commands/triage.md`, dan `commands/inspect.md`.
  - Buat folder artefak spesifikasi: `mkdir -p _ompimpa/specs/ _ompimpa/inspeksi/`.
- [ ] **Langkah 3 (Penegakan Prompt Subagent):** Perbarui `commands/review.md` dengan blok injeksi teknis pemanggilan batch tool `task(isolated: true)` untuk 10 subagent lengkap dengan skema JSON target `_ompimpa/review/`.
- [ ] **Langkah 4 (Bersihkan reviewer.ts):** Hapus mock scanning inline di `src/reviewer.ts:dispatchIsolatedReview()`, kembalikan perannya sebagai validator murni berkas JSON hasil review subagent.
- [ ] **Langkah 5 (Outer Loop Driver):** Lengkapi implementasi `handleDev` di `src/cli.ts` (atau buat `src/loop_runner.ts`) agar menghubungkan loop DAG stories ke eksekusi fase otomatis.

---

*Risalah resmi dicatat oleh Mohammad Yamin (`ompimpa-doc`) dan disahkan oleh Ketua Sidang. Palu sidang diketuk tiga kali: **tok-tok-tok**. Sidang dinyatakan selesai dan ditutup.*
