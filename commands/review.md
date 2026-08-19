---
description: Menjalankan audit paralel 26 Hukum Besi dan Analisis Keamanan bersama Hj. Rasuna Said & Bagindo Azizchan
---

# Command: /review

Jalankan audit kode secara paralel menggunakan:
- `ompimpa-ironlaw` (Hj. Rasuna Said): Memeriksa kepatuhan diff terhadap 26 Hukum Besi Elixir.
- `ompimpa-security` (Bagindo Azizchan): Memeriksa celah keamanan CSRF, XSS, Atom Exhaustion, dan otorisasi IDOR.
- `ompimpa-test` (Tuanku Imam Bonjol): Menilai mutu tes dengan target skor $\ge 90$.

## Penggunaan
```bash
/review [opsional: path file / branch diff]
```

## Alur Kerja
1. Memindai git diff atau berkas yang baru diubah.
2. Mengeksekusi review multi-agen secara paralel.
3. Memberikan status keputusan: **PASSED** atau **BLOCKED (beserta panduan perbaikan)**.
