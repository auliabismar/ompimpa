---
description: Menampilkan graph blast-radius modul Elixir via mix xref dan LSP fallback
---

# Command: /ompimpa:graphify

Menghasilkan `_ompimpa/graph.json` dan `_ompimpa/graph.html` via `mix xref graph --format json` dengan fallback `lsp references` / `regex_scan` jika xref >2s.

## Penggunaan
```bash
ompimpa graphify                 # generate _ompimpa/graph.json + graph.html
ompimpa graphify --blast lib/accounts.ex  # tampilkan blast-radius terdampak
```

## Alur

1. Coba `mix xref graph --format json --label compile-connected` dengan timeout 1500ms.
2. Jika gagal/timeout >2s → fallback `regex_scan` lazy per file (scan `lib/**/*.ex` max 500 file, parse `alias/use/import`).
3. Blast-radius: `lib/accounts.ex` → BFS reverse edges → list `lib/*_web/live/*` terdampak.
4. Tulis `graph.json` (`nodes, edges, generated_at, stats, blast_radius_example, circular_check`) dan `graph.html` visual.
5. Reviewer `ompimpa-ecto` / `ompimpa-prd` pakai `graph.json` untuk TEA-15 boundary & TEA-16 circular.

## Kill Criteria
Jika `xref >2s` di 500 file → fallback LSP lazy per file; jika masih >2s → cache `_ompimpa/.cache/graph.json`.

## AC
- AC-C01-1: `lib/accounts.ex` → `_ompimpa/graph.json` list `live/*` terdampak, <2s di 500 file.
- AC-C01-2: `graph.json` dipakai reviewer TEA-16/15.
