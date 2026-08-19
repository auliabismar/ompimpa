---
description: Mencatat keputusan arsitektur (ADR) berstandar MADR bersama H. Agus Salim
---

# Command: /ompimpa:adr

Jalankan subagent `ompimpa-prd` (H. Agus Salim) untuk menyusun dokumen Architecture Decision Record (ADR) berformat MADR 3.0+ lengkap dengan evaluasi trade-off dan penegakan invariant BEAM/Phoenix.

## Penggunaan
```bash
/ompimpa:adr [judul keputusan arsitektur]
```

## Alur Kerja
1. Menganalisis konteks masalah dan constraint teknis proyek.
2. Membandingkan minimal 2-3 opsi nyata dengan kelebihan/kekurangan masing-masing.
3. Mendokumentasikan keputusan dan mitigasi konsekuensi.
4. Menyimpan berkas di `_ompimpa/adr/ADR-[NUM]-[judul].md`.
