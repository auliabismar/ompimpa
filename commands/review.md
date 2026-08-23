---
description: Menjalankan audit paralel 26 Hukum Besi dan Analisis Keamanan bersama Hj. Rasuna Said & Bagindo Azizchan
---

# Command: /review

Jalankan audit kode secara paralel menggunakan panel 6 subagent spesialis:
1. **`ompimpa-ironlaw` (Hj. Rasuna Said)**: Memeriksa kepatuhan diff terhadap 26 Hukum Besi Elixir.
2. **`ompimpa-security` (Bagindo Azizchan)**: Memeriksa celah keamanan CSRF, XSS, Atom Exhaustion, dan otorisasi IDOR.
3. **`ompimpa-test` (Tuanku Imam Bonjol)**: Menilai mutu tes dengan target scorecard $\ge 90$ dan isolasi sandbox.
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
