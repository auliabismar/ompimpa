---
description: "Mencegah penggunaan assign_new untuk data dinamis per-mount seperti current_user (Hukum Besi #18)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'assign_new\(socket,\s*:(?:current_user|current_tenant|timezone|locale|session)[,\s]'
interruptMode: always
---

# Pelanggaran Hukum Besi #7: No assign_new for Dynamic Per-Mount Values

Anda terdeteksi menggunakan `assign_new/3` untuk data yang harus di-refresh setiap mount.

### Mengapa Dilarang?
`assign_new` hanya set jika belum ada, meng-cache stale data antar navigasi; `current_user` yang berubah tidak akan ter-refresh.

### Solusi Wajib:
Gunakan `assign/3` langsung:
```elixir
socket |> assign(:current_user, current_user)
```
Hanya gunakan `assign_new` untuk data statis/deterministic.
