---
description: "Mewajibkan query terpisah untuk has_many dan join untuk belongs_to (Hukum Besi #7)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'preload:\s*\[[^\]]*:[^\]]*\].*join:'
interruptMode: always
---

# Pelanggaran Hukum Besi #9: Ecto Relationship Loading

Anda terdeteksi menggunakan preload has_many bersama join yang memicu Cartesian product.

### Mengapa Dilarang?
Menggabungkan `has_many` preload dengan join tanpa query terpisah menghasilkan duplikasi baris eksponensial.

### Solusi Wajib:
- `has_many`: query terpisah + `Repo.preload` / `Ash.load`.
- `belongs_to`: gunakan `join` dengan `on:` eksplisit.
```elixir
posts = Repo.all(Post) |> Repo.preload(:comments)
```
