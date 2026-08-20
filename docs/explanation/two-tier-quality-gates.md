# Penjelasan: Arsitektur Gerbang Mutu Bertingkat (Multi-Tier Quality Gates) & Pemisahan Tanggung Jawab

Dokumen penjelasan ini membedah alasan teknis mengapa OMP-IMPA menerapkan pertahanan mutu berlapis bertingkat (**Tier 0: TTSR Real-Time Stream Guard**, **Tier 1: OMP Runtime Guard Hook**, **Tier 2: Fast Git Pre-Commit Gate**, dan **Tier 3: Macro-Review & Full Verification Suite**), serta bagaimana arsitektur ini mencegah eksekusi ganda (*double execution*) dan menjaga alur koding tetap instan.

---

## 1. Masalah Bottleneck dan Eksekusi Ganda (*Double Execution Trap*)

Dalam ekosistem AI-coding agent, terdapat dua jebakan performa utama:
1. **The Monolithic Review Bottleneck**: Jika review hanya dilakukan di akhir proyek saat PR dibuka, kesalahan fundamental pada Story 1 (seperti tipe `:float` pada uang atau lupa otorisasi) akan merembet ke seluruh story lainnya.
2. **The Double Execution & Slow Test Penalty**: Jika setiap kali agent melakukan `git commit`, OMP hook menjalankan kompilasi/tes, lalu Git hook asli juga menjalankan `mix test` global tanpa parameter, waktu tunggu commit membengkak menjadi puluhan detik (bahkan menit). Selain itu, perintah `mix test` global mengeksekusi seluruh suite tes proyek, yang sangat lambat dan memboroskan sumber daya komputasi.

---

## 2. Solusi OMP-IMPA: Multi-Tier Quality Gates Architecture

OMP-IMPA memisahkan tanggung jawab pemeriksaan secara presisi pada setiap fase eksekusi:

```
[1. SAAT LLM MENGETIK]
       │
       ▼
[TIER 0: TTSR STREAM GUARD] ──────(Pola Salah?)──► [ABORT & ROLLBACK INSTAN (~0 ms)]
       │ (Lolos/Bersih)
       ▼
[2. SAAT PROSES KODING & TESTING SLICE]
       │
       ▼
[SCOPED TESTING] ────────────────► mix test test/path/specific_test.exs (< 1-2 detik)
       │
       ▼
[TIER 1: OMP RUNTIME HOOK] ──────► 1. tool_call: Blokir `git commit --no-verify` (Iron Law #26)
(`hooks/ompimpa-guard.ts`)         2. tool_result: Pangkas stacktrace panjang ExUnit (Hemat 60-80% token)
                                   3. session_stop: Lanjutkan loop otonom berbasis status disk YAML
       │
       ▼
[3. SAAT GIT COMMIT]
       │
       ▼
[TIER 2: FAST GIT PRE-COMMIT GATE]► ⚡ Sub-2-Detik Gate (Tanpa global test):
(`.git/hooks/pre-commit`)          1. Diff scanner: Cek cepat :float uang & String.to_atom
                                   2. Incremental strict compiler: mix compile --warnings-as-errors
                                   3. Formatter: mix format --check-formatted
       │
       ▼
[4. SELESAI 1 FITUR / PR]
       │
       ▼
[TIER 3: MACRO-REVIEW & VERIFY] ──► 1. /ompimpa:review: Panel 4-Jalur (Rasuna Said, Azizchan, Imam Bonjol, QA)
                                   2. /ompimpa:verify: Full `mix test` + Credo Strict + Sobelow Security
```

---

## 3. Rincian Peran Tiap Tingkat (Tier Details)

### Tier 0 — TTSR Real-Time Stream Guard (In-Stream, 0-Token Waste)
* **Tempat**: `rules/elixir-*.md`
* **Waktu**: Saat token teks/kode sedang di-generate secara *streaming* oleh LLM.
* **Tanggung Jawab**: Mendeteksi pola sintaksis fatal (misal: `:float` pada field harga/saldo, `String.to_atom/1`, `Phoenix.HTML.raw/1`, cross join implisit) sebelum kode menyentuh disk.
* **Tindakan**: Langsung mengaborsi stream dan meminta model mengoreksi kode seketika.

### Tier 1 — OMP Runtime Guard Hook (`hooks/ompimpa-guard.ts`)
* **Tempat**: OMP Extension / Hook Runtime (`tool_call`, `tool_result`, `session_stop`, `ttsr_triggered`).
* **Waktu**: Sebelum/setelah pemanggilan tool dan saat transisi sesi agent.
* **Tanggung Jawab**:
  1. **Bypass Blocker**: Memblokir keras perintah `git commit --no-verify` atau `-n` agar standar mutu tidak dilompati.
  2. **Token Saver**: Memangkas stacktrace internal framework dari kegagalan `mix test` yang berukuran > 3.500 karakter agar konteks LLM tidak membengkak.
  3. **Dev Loop Continuation**: Membaca `_ompimpa/status/feature-status.yaml` pada event `session_stop` untuk melanjutkan loop `/ompimpa:dev --auto` secara mulus.
* **Prinsip**: *Zero Heavy Computation* (tidak menjalankan kompilasi/tes lambat di dalam OMP Hook).

### Tier 2 — Fast Git Pre-Commit Gate (`.git/hooks/pre-commit`)
* **Tempat**: Git native hook yang diinstal oleh `ompimpa init`.
* **Waktu**: Saat perintah `git commit` dijalankan oleh sistem operasi.
* **Tanggung Jawab**:
  1. Pemindaian cepat diff staged (`git diff --cached`) terhadap aturan kritis.
  2. Kompilasi ketat inkremental (`mix compile --warnings-as-errors`).
  3. Pemeriksaan format kode (`mix format --check-formatted`).
* **Prinsip Utama**: **Sub-2-Detik**. Operasi `mix test` global **sengaja ditiadakan** di pre-commit agar proses commit tetap instan.

### Tier 3 — Macro-Review & Full Verification Suite (`/ompimpa:verify`)
* **Tempat**: Perintah eksplisit `/ompimpa:review` dan `/ompimpa:verify`.
* **Waktu**: Di akhir implementasi fitur, sebelum merge branch, atau pada pipeline CI/CD.
* **Tanggung Jawab**:
  1. Audit semantik mendalam oleh panel 4-jalur (Hj. Rasuna Said, Bagindo Azizchan, Tuanku Imam Bonjol).
  2. Eksekusi menyeluruh seluruh rangkaian tes proyek (`mix test`), static analysis Credo (`mix credo --strict`), dan security audit Sobelow (`mix sobelow --config --exit`).

---

## 4. Matriks Perbandingan & Pencegahan Redundansi

| Pemeriksaan | Tier 0 (TTSR) | Tier 1 (OMP Hook) | Tier 2 (Git Hook) | Tier 3 (Verify) |
| :--- | :---: | :---: | :---: | :---: |
| **Inline Syntax Patterns** | ✅ (~0ms) | ❌ (Dilewati) | ❌ (Dilewati) | ❌ (Dilewati) |
| **Bypass Prevention (`--no-verify`)** | ❌ | ✅ (< 1ms) | ❌ | ❌ |
| **Token Truncation** | ❌ | ✅ (< 1ms) | ❌ | ❌ |
| **Staged Diff Scan** | ❌ | ❌ | ✅ (< 100ms) | ❌ |
| **Strict Incremental Compilation** | ❌ | ❌ | ✅ (< 1.5s) | ✅ |
| **Code Formatting Check** | ❌ | ❌ | ✅ (< 300ms) | ✅ |
| **Scoped Slice Test** | ❌ | ❌ | ❌ | Dilakukan saat Dev Loop |
| **Global Full Test Suite** | ❌ | ❌ | ❌ (Ditiadakan demi kecepatan) | ✅ (Menyeluruh) |
