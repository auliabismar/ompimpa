---
description: "Mewajibkan @external_resource untuk file eksternal yang dibaca saat kompilasi (Hukum Besi #14)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'File\.read!.*priv'
interruptMode: always
---

# Pelanggaran Hukum Besi #22: Compile-Time External Resources

Anda terdeteksi membaca file eksternal saat kompilasi tanpa `@external_resource`.

### Mengapa Dilarang?
Tanpa deklarasi, perubahan file eksternal tidak trigger recompilation, menyajikan stale data.

### Solusi Wajib:
```elixir
@external_resource Path.join(:code.priv_dir(:my_app), "data.json")
@data File.read!(@external_resource) |> Jason.decode!()
```
