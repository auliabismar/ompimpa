---
description: "Mencegah eksekusi query database tanpa batas/limit langsung di dalam LiveView mount atau event handlers (Hukum Besi #3)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'def\s+(?:mount|handle_params|handle_event)\([^)]*\)[\s\S]*?\bRepo\.all\(\s*(?:[A-Z][a-zA-Z0-9_]*|from\s*\([a-z]\s+in\s+[A-Z][a-zA-Z0-9_]*(?![^)]*\blimit\b))\s*\)'
interruptMode: always
---

# Pelanggaran Hukum Besi #3: Unbounded Database Query di LiveView

Anda terdeteksi mengeksekusi query database telanjang (`Repo.all/1`) tanpa batas limit atau paginasi di dalam lifecycle LiveView (`mount/3`, `handle_params/3`, atau `handle_event/3`).

### Mengapa Dilarang?
Memanggil query tanpa klausa `limit` atau paginasi di dalam proses LiveView berpotensi menarik ribuan hingga jutaan baris data ke dalam memori BEAM secara sinkron. Hal ini menyebabkan:
1. **Connection Pool Starvation**: Koneksi Ecto tertahan terlalu lama, memblokir request pengguna lain.
2. **GenServer Timeout**: LiveView process mengalami timeout (5000ms) saat rendering awal.
3. **Pemuatan UI Lambat**: Payload diff WebSocket menjadi sangat besar.

### Solusi Wajib:
1. **Terapkan Limit atau Paginasi Berbasis Kursor (Keyset Pagination)**:
   ```elixir
   def mount(_params, _session, socket) do
     products =
       Product
       |> order_by(desc: :inserted_at)
       |> limit(50)
       |> Repo.all()

     {:ok, stream(socket, :products, products)}
   end
   ```

2. **Gunakan `assign_async/3` untuk Data Berat non-blocking**:
   ```elixir
   def mount(_params, _session, socket) do
     {:ok,
      socket
      |> assign_async(:analytics, fn ->
        {:ok, %{analytics: Analytics.compute_summary(limit: 30)}}
      end)}
   end
   ```
