---
description: "Mewajibkan pengecekan changeset errors sebelum debug form LiveView (Hukum Besi #19b)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'IO\.inspect\(changeset\.errors\)'
interruptMode: always
---

# Pelanggaran Hukum Besi #8: Check Changeset Errors Before Form Debug

Anda terdeteksi melakukan debug form tanpa memeriksa `changeset.errors` eksplisit.

### Mengapa Dilarang?
Tanpa pengecekan eksplisit, error validasi tersembunyi di assign, menyulitkan pelacakan.

### Solusi Wajib:
Periksa `changeset.valid?` dan `changeset.errors` sebelum assign:
```elixir
if changeset.valid? do
  Repo.insert(changeset)
else
  Logger.debug(inspect(changeset.errors))
  {:error, changeset}
end
```
