---
description: "Mencegah penugasan koleksi/daftar query langsung ke socket assigns tanpa LiveView Streams atau temporary_assigns (Hukum Besi #4)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'assign\(socket,\s*:(?:items|products|users|orders|logs|events|records|posts|messages|comments|rows|list|data),\s*(?:Repo\.all|Ash\.read!?)'
interruptMode: always
---

# Pelanggaran Hukum Besi #4: Memory Hygiene & LiveView Streams

Anda terdeteksi menugaskan daftar data hasil query basis data langsung ke `socket.assigns` tanpa mekanisme penghematan memori.

### Mengapa Dilarang?
Phoenix LiveView menyimpan seluruh isi `socket.assigns` di dalam memori heap proses GenServer masing-masing pengguna. 
Menyimpan daftar data besar (koleksi record) secara langsung akan menduplikasi memori untuk setiap koneksi WebSocket yang aktif, memicu lonjakan konsumsi RAM server dan *Garbage Collection latency*.

### Solusi Wajib:
1. **Gunakan `LiveView.Streams` (Direkomendasikan di Phoenix 1.7+)**:
   ```elixir
   def mount(_params, _session, socket) do
     products = Products.list_products(limit: 50)

     {:ok,
      socket
      |> stream(:products, products)}
   end
   ```
   Dan di template HEEx:
   ```heex
   <ul id="products" phx-update="stream">
     <li :for={{dom_id, product} <- @streams.products} id={dom_id}>
       <%= product.name %>
     </li>
   </ul>
   ```

2. **Atau Gunakan `temporary_assigns` jika Data Hanya untuk Render Sekali**:
   ```elixir
   def mount(_params, _session, socket) do
     {:ok,
      socket
      |> assign(:logs, Logs.fetch_recent(limit: 100)),
      temporary_assigns: [logs: []]}
   end
   ```
