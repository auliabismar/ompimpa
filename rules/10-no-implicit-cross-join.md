---
description: "Mencegah penulisan query Ecto multi-tabel tanpa klausa join/on eksplisit (Hukum Besi #13)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'from\s*\(\s*[a-zA-Z0-9_]+\s+in\s+[^,]+,\s*[a-zA-Z0-9_]+\s+in\s+[^,)]+\)'
interruptMode: always
---

# Pelanggaran Hukum Besi #10: No Implicit Cross Joins

Anda terdeteksi menulis `from(a in A, b in B)` tanpa `join/on:`.

### Mengapa Dilarang?
Cartesian product 1k×1k = 1M baris, memori DB membengkak.

### Solusi Wajib:
```elixir
from a in User,
  join: p in assoc(a, :profile),
  on: a.id == p.user_id,
  select: {a, p}
```
