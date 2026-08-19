---
description: Menjalankan Quality Gate kompilator ketat (warnings-as-errors, credo, format, tests)
---

# Command: /verify

Mengeksekusi loop verifikasi kualitas mekanis secara berurutan:
1. `mix compile --warnings-as-errors`
2. `mix format --check-formatted`
3. `mix credo --strict` (jika terpasang)
4. `mix sobelow --config --exit` (jika terpasang)
5. `mix test`

## Penggunaan
```bash
/verify
```

## Hasil
Semua langkah wajib berstatus hijau (0 warning, 0 error, 100% tes lolos) untuk memenuhi standar **Hukum Besi #26 (Verify Before Claiming Done)**.
