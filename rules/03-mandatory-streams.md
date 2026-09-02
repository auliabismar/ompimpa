---
description: "Mewajibkan LiveView Streams atau temporary_assigns untuk koleksi besar (Hukum Besi #4)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'assign\(socket,\s*:(?:items|products|users|orders|logs|events|records|posts|messages|comments|rows|list|data),\s*(?:Repo\.all|Ash\.read!?)'
interruptMode: always
---

# Pelanggaran Hukum Besi #3: Streams for Large Lists

Anda terdeteksi menugaskan daftar data hasil query langsung ke `socket.assigns` tanpa Streams atau `temporary_assigns`.

### Mengapa Dilarang?
Menyimpan koleksi besar di `socket.assigns` menduplikasi memori per koneksi WebSocket, memicu lonjakan RAM dan GC latency.

### Solusi Wajib:
1. Gunakan `stream/3`:
   ```elixir
   {:ok, stream(socket, :products, products)}
   ```
2. Atau `temporary_assigns: [products: []]`.
3. Template gunakan `phx-update="stream"` dengan dom_id.
