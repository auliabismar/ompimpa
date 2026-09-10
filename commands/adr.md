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
1. Menganalisis konteks masalah dan constraint teknis proyek — ADR dilarang menyalin retorika sapu-jagat Balairung; tiap keputusan trio opsi wajib merujuk baris Tabel Inventaris.
2. Membandingkan minimal 2-3 opsi nyata dengan kelebihan/kekurangan masing-masing.
3. Mendokumentasikan keputusan dan mitigasi konsekuensi. Modul inventaris yang ditunda wajib dicatat sebagai Scope Deferral Record eksplisit (bukan dihilangkan diam-diam).
4. Menyimpan berkas di `_ompimpa/adr/ADR-[NUM]-[judul].md`.
5. Memajukan tiap story terdampak di `_ompimpa/status/feature-status.yaml` ke `status: ready-for-atdd` + tautan `adr:` (milestone adr-approved; never-regress).
