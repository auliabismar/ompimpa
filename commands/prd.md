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
1. Membaca risalah Balairung — WAJIB ada Tabel Inventaris (INV-10); tolak sapu-jagat tanpa tabel.
2. Menyusun Functional Requirements (FR) dan Non-Functional Requirements (NFR) dengan cakupan 1:1 terhadap tiap modul inventaris (INV-11 anti scope-truncation: modul hilang hanya via Scope Deferral Record di ADR).
3. Menyusun Epics Spine dengan Acceptance Criteria siap uji ATDD.
4. Mendaftarkan skeleton tiap story ke `_ompimpa/status/feature-status.yaml` dengan `status: backlog` + tautan `prd:` (milestone prd-approved).
5. Menyimpan berkas di `_ompimpa/prd/PRD-[ID]-[nama].md`.
6. Validasi mekanis: `ompimpa inventory --balairung <risalah> --prd <prd> --stories _ompimpa/stories.yaml` (exit 0).
