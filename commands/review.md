---
description: Menjalankan audit paralel 26 Hukum Besi dan Analisis Keamanan bersama Hj. Rasuna Said & Bagindo Azizchan
---

# Command: /review

Jalankan audit kode menyeluruh yang memadukan **Review Fungsional (Spec vs Code)** dan **Review Kepatuhan Teknis (Technical Compliance)**:

### A. Review Fungsional / Spesifikasi (BMAD / BMM)
* **`ompimpa-prd` (H. Agus Salim)** & **`requirements-verifier`**:
  1. **Acceptance Criteria Verification**: Memvalidasi diff kode terhadap kriteria Gherkin di PRD (`_ompimpa/prd/`).
  2. **Anti-Scope-Creep Check**: Memastikan tidak ada fitur atau logika tak terdokumentasi di luar PRD.
  3. **Deletion Contract Check**: Memastikan refactoring tidak menghilangkan kontrak fungsional yang masih dibutuhkan.

### B. Review Kepatuhan Teknis (phxagents Specialist Panel)
1. **`ompimpa-ironlaw` (Hj. Rasuna Said)**: Memeriksa kepatuhan diff terhadap 26 Hukum Besi Elixir.
2. **`ompimpa-security` (Bagindo Azizchan)**: Memeriksa celah keamanan CSRF, XSS, Atom Exhaustion, dan otorisasi IDOR.
3. **`ompimpa-test` (Tuanku Imam Bonjol)**: Menilai mutu tes dengan target TEA scorecard $\ge 90$, mendeteksi *broken-verification*, dan isolasi sandbox.
4. **`ompimpa-verify`**: Memverifikasi kompilasi strict (`--warnings-as-errors`), formatter, dan static linters.
5. **`ompimpa-ecto` / `ash`**: Memeriksa anti-pattern N+1 queries, pinning operator `^`, indexing, dan fail-closed policies.
6. **`ompimpa-liveview` / `oban`**: Memeriksa assigns memory hygiene, Streams pada dataset besar, dan idempotensi Oban.
## Penggunaan
```bash
/review [opsional: path file / branch diff]
```

## Alur Kerja
1. Memindai git diff atau berkas yang baru diubah.
2. Mengeksekusi review multi-agen secara paralel.
3. Memberikan status keputusan: **PASSED** atau **BLOCKED (beserta panduan perbaikan)**.
