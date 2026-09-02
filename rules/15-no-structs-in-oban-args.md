---
description: "Mencegah penyimpanan struct di argumen job Oban (Hukum Besi #8c)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'args:\s*%\{.*%[A-Z]'
interruptMode: always
---

# Pelanggaran Hukum Besi #15: No Structs in Oban Args

Anda terdeteksi menyimpan struct di argumen Oban.

### Mengapa Dilarang?
Struct tidak serializable JSON dengan aman; perubahan schema struct merusak job lama di DB, dan payload membengkak.

### Solusi Wajib:
Hanya simpan primitives / string keys:
```elixir
%{"user_id" => user.id, "plan" => "pro"}
|> MyWorker.new()
|> Oban.insert()
```
