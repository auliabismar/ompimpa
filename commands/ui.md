---
description: Merancang komponen HEEx, styling Tailwind CSS, dan CoreComponents bersama Marah Rusli
---

# Command: /ui

Jalankan subagent `ompimpa-ui` (Marah Rusli) untuk merancang antarmuka LiveView, komponen HEEx modular, styling Tailwind CSS responsif, interaktivitas JS commands, dan verifikasi visual via Chromium.

## Penggunaan
```bash
/ui [deskripsi komponen / perbaikan antarmuka]
```

## Alur Kerja
1. Membaca spesifikasi UI dari PRD / User Story terkait.
2. Menyusun template HEEx dengan slot modular dan kelas Tailwind semantik.
3. Menjalankan verifikasi visual via Headless Chromium (`xd://browser`) jika diperlukan.
