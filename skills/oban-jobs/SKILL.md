---
name: oban-jobs
description: Panduan arsitektur background job Oban (Worker Idempotency, String Key Args, Unique Jobs, Error Handling).
---

# Skill: Oban Job Architecture

## Hukum Besi & Pola Inti
1. **Idempotensi Worker (Hukum Besi #8)**: Semua worker wajib idempotent sehingga aman dieksekusi berulang kali saat terjadi retry.
2. **String Keys pada Argumen**: Oban men-serialize data ke JSON; selalu akses `args["id"]`, bukan `args[:id]`.
3. **Dilarang Menyimpan Struct pada Argumen**: Kirimkan identifier primitif (string/integer), lalu muat ulang data terbaru di dalam `perform/1`.
4. **Propagasi Locale (Hukum Besi #21)**: Tangkap locale proses Gettext/CLDR sebelum enqueueing dan simpan di argumen job agar terjemahan email/notifikasi akurat.
5. **Job Unik (Unique Jobs)**: Konfigurasikan opsi `unique:` untuk mencegah duplikasi eksekusi task yang sama secara bersamaan.
