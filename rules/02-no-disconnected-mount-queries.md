---
description: "Mencegah query database berat tanpa guard connected? di mount LiveView (Hukum Besi #3)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'def\s+(?:mount|handle_params)\([^)]*\)[\s\S]*?\bRepo\.all\(\s*(?:[A-Z][a-zA-Z0-9_]*|from\s*\([a-z]\s+in\s+[A-Z][a-zA-Z0-9_]*(?![^)]*\blimit\b))\s*\)'
interruptMode: always
---

# Pelanggaran Hukum Besi #2: No Unconditional DB Queries in Mount

Anda terdeteksi mengeksekusi query database telanjang tanpa guard `connected?(socket)` atau `assign_async` di `mount/3`.

### Mengapa Dilarang?
LiveView mount dipanggil dua kali (HTTP disconnected + WebSocket connected). Query berat sinkron memblokir render awal dan menguras connection pool.

### Solusi Wajib:
1. Guard dengan `if connected?(socket)`:
   ```elixir
   def mount(_p, _s, socket) do
     if connected?(socket) do
       assigns = load_data()
       {:ok, assign(socket, :data, assigns)}
     else
       {:ok, socket}
     end
   end
   ```
2. Atau gunakan `assign_async/3` untuk data berat non-blocking.
3. Terapkan `limit` / paginasi keyset.
