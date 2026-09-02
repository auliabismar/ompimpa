---
description: "Mencegah konversi string dinamis ke atom via String.to_atom/1 untuk mencegah Atom DoS (Hukum Besi #9)"
globs: ["*.ex", "*.exs"]
scope: "tool:edit(*.ex), tool:edit(*.exs), tool:write(*.ex), tool:write(*.exs)"
condition:
  - 'String\.to_atom\('
interruptMode: always
---

# Pelanggaran Hukum Besi #17: No String.to_atom on User Input

Anda terdeteksi memanggil `String.to_atom/1`.

### Mengapa Dilarang?
Tabel atom BEAM global tidak di-GC; flood string acak → 1M atom limit → node crash.

### Solusi Wajib:
```elixir
String.to_existing_atom(param)
# atau whitelist map:
case param do
  "admin" -> :admin
  "member" -> :member
  _ -> :invalid
end
```
