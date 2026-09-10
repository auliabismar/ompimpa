---
id: SOL-004
topic: zero-tolerance-modal-crud-linter
tags: [ironlaw, liveview, modal, crud, linter]
stack: [elixir, phoenix, liveview, bash]
date: 2026-09-08
---

# Solusi SOL-004: Penegakan Mekanis Borgol Linter Anti-Modal CRUD

## Gejala & Masalah
Meskipun keputusan arsitektur (ADR/Balairung) secara tegas melarang pembuatan atau penyuntingan formulir master dan transaksi di dalam popup modal, AI agent dan pengembang secara berulang membuat atau mempertahankan modal CRUD (`<.modal>`, `open_*modal`, `show_*modal`) serta tes yang memvalidasi interaksi modal.

## Akar Penyebab (Root Cause)
1. Ketiadaan gerbang mekanis *fail-fast* pada tahap kompilasi dan precommit yang memblokir secara instan.
2. Generator standar Phoenix `phx.gen.live` secara default men-generate komponen modal terintegrasi, yang sering disalin mentah-mentah.

## Pola Solusi yang Terbukti (Proven Fix)
1. **Pola Arsitektur Rute Dedikasi**:
   Seluruh formulir master dan transaksi wajib menggunakan rute halaman penuh terdedikasi:
   - Index: `/nama_fitur`
   - Buat Baru: `/nama_fitur/baru`
   - Ubah: `/nama_fitur/:id/ubah`
   Dibungkus dengan layout `<.form_workspace>`.

2. **Skrip Borgol Mekanis Linter (`scripts/audit_iron_laws.sh`)**:
   Kaitkan skrip pemindaian regex pada tahap `mix precommit` / Git hook pre-commit:
   ```bash
   # Gagal jika form/input ditemukan di dalam modal untuk modul master/transaksi
   if grep -rnE "<\.modal.*(form|new|edit)" lib/*_web/live/; then
     echo "❌ ERROR: Pelanggaran Hukum Besi LiveView: Dilarang Modal CRUD!"
     exit 1
   fi
   ```

## Invariant Pencegahan Regresi
1. Modal HANYA diizinkan untuk dialog konfirmasi destruktif tanpa form input (misal: "Apakah Anda yakin ingin menghapus data ini?").
2. Suite pengujian ATDD wajib menguji navigasi halaman penuh (`assert_patch` / `push_navigate`) dan melarang asersi `has_element?("#modal-dialog")` untuk alur input data.
