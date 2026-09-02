---
description: "Mencegah interpolasi string langsung di query Ecto tanpa pinning ^ (Hukum Besi #6)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'from\s+[a-zA-Z_][a-zA-Z0-9_]*\s+in\s+[A-Z][a-zA-Z0-9_.]*,\s*where:[^\n]*#\{'
interruptMode: always
---

# Pelanggaran Hukum Besi #4: Ecto Pinning Operator

Anda terdeteksi melakukan interpolasi string langsung di query Ecto tanpa operator pinning `^`.

### Mengapa Dilarang?
Interpolasi langsung membuka celah SQL injection dan merusak query cache Ecto. Selalu gunakan `^` untuk variabel.

### Solusi Wajib:
```elixir
from u in User, where: u.email == ^email
```
Hindari:
```elixir
from u in User, where: u.email == "#{email}"
```
