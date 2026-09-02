---
description: "Mewajibkan deduplikasi data sebelum cast_assoc dengan shared data (Hukum Besi #15)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'cast_assoc\([^)]*with:\s*&.*\).*\n.*cast_assoc'
interruptMode: always
---

# Pelanggaran Hukum Besi #11: Dedup Before cast_assoc

Anda terdeteksi memanggil `cast_assoc` tanpa deduplikasi shared data.

### Mengapa Dilarang?
Tanpa dedup, entitas shared duplikat menimbulkan constraint violation dan Orphaned records.

### Solusi Wajib:
Dedup sebelum cast:
```elixir
attrs = Map.update!(attrs, "tags", fn tags -> Enum.uniq_by(tags, & &1["name"]) end)
changeset |> cast_assoc(:tags)
```
