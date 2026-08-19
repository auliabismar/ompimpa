---
description: Memindai dan menyusun prioritas pembersihan hutang teknis (Credo strict, dead code, kompleksitas fungsi)
---

# Command: /ompimpa:techdebt

Memindai hutang teknis pada codebase Elixir dan menyusun rencana refaktorisasi terstruktur:

## Penggunaan
```bash
/ompimpa:techdebt
```

## Alur Kerja
1. Menjalankan `mix credo --strict` dan menganalisis area kode dengan kompleksitas siklomatis tinggi.
2. Mendeteksi kode mati (*dead code*) atau fungsi yang tidak pernah dipanggil via `mix xref unreachable`.
3. Menghasilkan laporan prioritas pembersihan hutang teknis (P1: Krusial, P2: Refaktor Menengah, P3: Polesan Gaya).
4. Opsi otomatis mengonversi temuan P1 menjadi task perbaikan di `_ompimpa/status/feature-status.yaml`.
