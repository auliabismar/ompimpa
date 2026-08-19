---
description: Menyelaraskan kembali PRD, ADR, dan tes saat terjadi perubahan kebutuhan atau kendala teknis
---

# Command: /ompimpa:course-correct

Jalankan subagent `ompimpa-prd` (H. Agus Salim) dan `ompimpa-triz` (Tan Malaka) untuk melakukan kalibrasi ulang rencana ketika menemui kendala arsitektur atau perubahan kebutuhan produk di tengah jalan.

## Penggunaan
```bash
/ompimpa:course-correct [penjelasan kendala / perubahan kebutuhan]
```

## Alur Kerja
1. Menganalisis dampak perubahan terhadap PRD eksisting dan modul yang sudah dibuat.
2. Memperbarui dokumen `_ompimpa/prd/PRD-[ID].md` dengan status revisi.
3. Menghasilkan ADR baru di `_ompimpa/adr/` yang mendokumentasikan alasan perubahan haluan.
4. Menyelaraskan status story di `_ompimpa/status/feature-status.yaml` (menandai story usang sebagai `superseded` dan menambahkan story baru).
5. Memperbarui skenario tes ATDD merah agar sesuai dengan kontrak baru.
