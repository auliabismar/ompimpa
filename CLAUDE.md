# OMP-IMPA Project Rules — Greenfield (scope=full)

## Aturan Inti
- Jalankan `/review` sebelum melakukan commit kode.
- Jalankan `/verify` untuk memastikan seluruh tes hijau dan tidak ada warning kompilator.
- Patuhi 26 Hukum Besi Elixir yang tercantum di `AGENTS.md`.

## Varian Wizard (C-04)
> **Type:** Greenfield — **Scope:** `full`
> - Greenfield `scope=full`: scaffold penuh dari nol (tanpa `mix.exs`).
> - Brownfield `scope=delta`: `mix.exs` ada & `lib/` tidak kosong → tulis Brownfield scope=delta, deteksi Ash/Oban dari mix.exs, jangan overwrite kode existing.
