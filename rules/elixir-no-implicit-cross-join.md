---
description: "Mencegah penulisan query Ecto multi-tabel tanpa klausa join/on eksplisit (Hukum Besi #13)"
globs: ["*.ex", "*.exs"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'from\s*\(\s*[a-zA-Z0-9_]+\s+in\s+[^,]+,\s*[a-zA-Z0-9_]+\s+in\s+[^,)]+\)'
interruptMode: always
---

# Pelanggaran Hukum Besi #13: Implicit Cross Joins

Anda terdeteksi menulis query Ecto dengan mendaftar beberapa sumber data dalam satu `from` tanpa klausa `join` atau `on:` yang eksplisit.

### Mengapa Dilarang?
Sintaks `from(a in A, b in B)` menghasilkan *Cartesian Product* (*Cross Join* implisit) di level database SQL. Jika tabel A memiliki 1.000 baris dan tabel B memiliki 1.000 baris, query akan menghasilkan 1.000.000 baris yang menghabiskan memori database dan server Phoenix.

### Solusi Wajib:
Selalu gunakan klausa `join` eksplisit dengan predikat `on:`:
```elixir
from a in MyApp.Accounts.User,
  join: p in assoc(a, :profile),
  on: a.id == p.user_id,
  select: {a, p}
```
Atau gunakan preload asosiasi jika relasi sudah terdefinisi di skema Ecto.
