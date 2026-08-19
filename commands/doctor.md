---
description: Mendiagnosis kesiapan toolchain, konfigurasi ompimpa.toml, dan kepatuhan proyek
---

# Command: /ompimpa:doctor

Menjalankan pemeriksaan kesehatan konfigurasi dan toolchain proyek:

## Penggunaan
```bash
/ompimpa:doctor
```

## Pemeriksaan
1. **Keberadaan Konfigurasi**: Memeriksa `mix.exs`, `ompimpa.toml`, `AGENTS.md`, dan hook pre-commit.
2. **Ketersediaan Toolchain**: Memeriksa binary `mix`, `git`, `bun`/`node`, dan proxy `rtk`.
3. **Pindai Cepat Hukum Besi**: Memindai ada/tidaknya pelanggaran mencolok (seperti tipe `:float` pada uang).
