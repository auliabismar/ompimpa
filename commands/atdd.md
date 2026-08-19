---
description: Merancang matriks risiko P1-P4 dan scaffolding tes merah Red-Phase ATDD bersama Tuanku Imam Bonjol
---

# Command: /atdd

Jalankan subagent `ompimpa-test` (Tuanku Imam Bonjol) untuk menganalisis Kriteria Penerimaan dari PRD/Story dan menghasilkan berkas tes penerimaan ExUnit/LiveViewTest yang sengaja **MERAH (failing)** sebelum implementasi dimulai.

## Penggunaan
```bash
/atdd [nomor Epic / Story / nama fitur]
```

## Alur Kerja
1. Membaca kriteria penerimaan dari PRD terkait.
2. Memetakan skenario uji ke dalam matriks risiko P1–P4.
3. Menulis scaffold tes merah di `test/my_app_web/live/` atau `test/my_app/`.
4. Memastikan tes gagal secara tepat karena fitur belum diimplementasikan.
