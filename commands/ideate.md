---
description: Memulai sesi curah pendapat (SCAMPER, Empathy Map, TRIZ) bersama Rohana Kudus & Tan Malaka
---

# Command: /ideate

Jalankan subagent `ompimpa-ideate` (Rohana Kudus) untuk membedah ide fitur baru, menggali kebutuhan pengguna, dan merumuskan How Might We (HMW) statements.

Jika terdapat kontradiksi atau trade-off teknis yang sulit, libatkan juga subagent `ompimpa-triz` (Tan Malaka).

## Penggunaan
```bash
/ideate [deskripsi ide / masalah produk]
```

## Alur Kerja
1. Membaca konteks proyek dan `ompimpa.toml`.
2. Menerapkan lensa SCAMPER dan Reverse Brainstorming.
3. Menghasilkan Matriks Ideasi dan Rekomendasi Fitur untuk PRD.
