---
description: Menyusun panduan User, Admin, dan Developer berformat Diátaxis bersama Mohammad Yamin
---

# Command: /doc

Jalankan subagent `ompimpa-doc` (Mohammad Yamin) untuk menyusun dokumentasi terstruktur berdasarkan 4 kuadran Diátaxis (Tutorials, How-To, Reference, Explanation) yang terikat langsung pada PRD, Epic, Story, dan kode aktual.

## Penggunaan
```bash
/doc user --epic 8         # Membuat User's Guide (Tutorial & How-to) untuk Epic 8
/doc admin --story 1.2     # Membuat Admin's Guide (Konfigurasi & Izin) untuk Story 1.2
/doc dev --module Accounts # Membuat Dev's Guide (Reference & Explanation) untuk modul Accounts
```

## Alur Kerja
1. Membaca spesifikasi PRD dan implementasi kode aktual yang sudah berjalan.
2. Memetakan konten ke dalam kuadran Diátaxis yang tepat tanpa mencampuradukkan tujuan.
3. Menyimpan berkas di `docs/user/`, `docs/admin/`, atau `docs/dev/`.
