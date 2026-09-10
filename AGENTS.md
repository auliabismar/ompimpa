# Instruksi Agen OMP-IMPA (Integrated Modular Phoenix Architecture) — Greenfield (scope=full)

Proyek ini dikelola menggunakan metodologi **OMP-IMPA** yang menggabungkan prinsip produk BMAD, keahlian mendalam Elixir/Phoenix, dan mesin eksekusi paralel OMP.

## 0. Varian Setup Wizard (C-04 Greenfield/Brownfield)
> **Project Type:** Greenfield — **Scope:** `full`
> - **Greenfield (scope=full):** `mix.exs` tidak ada atau `lib/` kosong → scaffold penuh `ompimpa.toml`, `docs/`, `AGENTS.md`, `CLAUDE.md`, `pre-commit`, `agents/`.
> - **Brownfield (scope=delta):** `mix.exs` ada & `lib/` tidak kosong → delta sync: jangan overwrite kode existing, tulis `AGENTS.md`/`CLAUDE.md` dengan penanda Brownfield scope=delta, `policy.toml` merge, deteksi `use_ash_framework`/`use_oban` dari `mix.exs`.

## 1. Siklus Hidup Terpadu (2 Sesi Bersih)
* **Sesi 1 — Discovery & Desain Produk (Chat / Diskusi)**:
  1. **Deliberasi Strategis**: Jalankan `/balairung` (Sidang 3-ronde Blind, Debat, Verdict bersama dewan tokoh) untuk keputusan sulit atau dilema arsitektur.
  2. **Ideasi & Musyawarah**: Jalankan `/ideate` (Rohana Kudus & Tan Malaka) untuk membedah ide dan melarutkan TRIZ trade-offs.
  3. **Spesifikasi & ADR**: Jalankan `/prd` dan `/adr` (H. Agus Salim) untuk mengunci Master PRD, Acceptance Criteria Gherkin, dan MADR.
  4. **Desain Visual & UX**: Jalankan `/ui` (Marah Rusli) untuk menyusun komponen HEEx, Tailwind CSS, dan prompt Google Stitch.
  *(Hasil disimpan ke `_ompimpa/`, sesi ditutup untuk menghemat konteks).*

* **Sesi 2 — Engineering & Eksekusi Otonom (Fresh Session)**:
  4. **Eksekusi Koding Otonom**: Jalankan `/dev` (atau `/dev --auto`) yang otomatis mencakup:
     - **Auto ATDD Red-Phase**: `ompimpa-test` (Tuanku Imam Bonjol) men-generate tes penerimaan merah per story.
     - **Koding Hijau**: Spesialis `ompimpa-ash`, `ompimpa-liveview`, `ompimpa-ecto`, `ompimpa-oban`, `ompimpa-otp` koding hingga tes hijau.
     - **Macro-Review 6-Jalur**: Audit paralel (IronLaw, Security, QA/Test, Compiler, Ecto/Ash, LiveView/Oban).
     - **Semantic Commit (`smol`)**: Generator pesan Conventional Commits (`feat/fix/test/refactor`) dan sinkronisasi state.
     *(Opsional: Jalankan `/atdd` jika ingin scaffolding tes merah mandiri).*
  5. **Verifikasi Mutu Global**: Jalankan `/review` dan `/verify` (`mix compile --warnings-as-errors` + full `mix test`).
  6. **Dokumentasi Diátaxis**: Jalankan `/doc` (Mohammad Yamin) untuk memperbarui panduan User, Admin, dan Dev.
## 2. 26 Hukum Besi Elixir (Non-Negotiable)
- Dilarang tipe `:float` untuk uang/saldo (Wajib `:decimal` / integer sen).
- Wajib verifikasi otorisasi socket di SETIAP `handle_event/3`.
- Wajib LiveView Streams (`stream/3`) untuk daftar data > 100 baris.
- Wajib operator pinning `^` pada query Ecto.
- Seluruh worker Oban wajib idempotent dengan string keys.
- Dilarang `String.to_atom/1` pada input dari luar.
- Kebijakan otorisasi Ash wajib *fail-closed* (*default deny*).
- Wajib verifikasi `mix compile --warnings-as-errors` dan `mix test` sebelum menyatakan pekerjaan selesai.

## 3. Konfigurasi Proyek
Konfigurasi modularitas diatur dalam `ompimpa.toml` (Greenfield full, Brownfield delta — deteksi otomatis dari `mix.exs`+`lib/`).
