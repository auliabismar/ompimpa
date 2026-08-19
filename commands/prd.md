---
description: Menyusun Master PRD dan Epics Spine bersama H. Agus Salim
---

# Command: /ompimpa:prd

Jalankan subagent `ompimpa-prd` (H. Agus Salim) untuk merumuskan dokumen Master PRD lengkap, pembagian Epics, cerita pengguna (*User Stories*), dan Kriteria Penerimaan (*Acceptance Criteria*) berformat Gherkin.

## Penggunaan
```bash
/ompimpa:prd [nama fitur / kebutuhan bisnis]
```

## Alur Kerja
1. Membaca output ideasi dari `_ompimpa/ideation/` atau prompt pengguna.
2. Menyusun Functional Requirements (FR) dan Non-Functional Requirements (NFR).
3. Menyusun Epics Spine dengan Acceptance Criteria siap uji ATDD.
4. Menyimpan berkas di `_ompimpa/prd/PRD-[ID]-[nama].md`.
