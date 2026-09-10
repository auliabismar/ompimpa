---
id: SOL-002
topic: liveview-stream-no-enumeration
tags: [liveview, streams, anti-pattern, crash, IL-03]
stack: [elixir, phoenix, liveview]
date: 2026-09-08
---

# Solusi SOL-002: Larangan Enumerasi `@streams` di Template LiveView

## Gejala & Masalah
Percobaan meng-enumerate `@streams` di template HEEx (contoh: `Enum.map(@streams.partners, ...)` atau helper yang menerima `@streams.xyz`) memicu runtime crash fatal:
```text
** (Protocol.UndefinedError) protocol Enumerable not implemented for #Phoenix.LiveView.Stream<...>
```
Hal ini sering terjadi saat pengembang ingin mengekstrak daftar ID yang terlihat (`visible_ids`) untuk fungsionalitas "Pilih Semua" (*Select All*).

## Akar Penyebab (Root Cause)
Struktur data `Phoenix.LiveView.Stream` sengaja tidak mengimplementasikan protokol `Enumerable` demi menjaga efisiensi memori (hygiene memori BEAM). Stream dirancang hanya untuk di-render melalui generator baris tabel dengan `id={dom_id}` dan atribut `phx-update="stream"`.

## Pola Solusi yang Terbukti (Proven Fix)
Jangan pernah mengekstrak atau meloop `@streams` secara langsung. Simpan daftar ID aktif sebagai assign terpisah yang ringan di socket:

```elixir
# DI CONTROLLER / LIVEVIEW MOUNT & FILTER:
socket =
  socket
  |> assign(:visible_partner_ids, Enum.map(partners, & &1.id))
  |> stream(:partners, partners)

# DI TEMPLATE HEEx:
# BUKAN: Enum.map(@streams.partners, ...) -> CRASH!
# MELAINKAN: Gunakan assign terpisah untuk ID yang terlihat
<input
  type="checkbox"
  checked={@all_selected}
  phx-click="toggle_select_all"
  phx-value-ids={Jason.encode!(@visible_partner_ids)}
/>
```

## Invariant Pencegahan Regresi
1. Dilarang keras sintaks `Enum.map(@streams`, `for ... <- @streams`, atau passing `@streams.xyz` ke fungsi di luar blok `phx-update="stream"`.
2. Asersi pengujian wajib menguji event `toggle_select_all` pada seluruh LiveView yang memiliki header seleksi massal.
