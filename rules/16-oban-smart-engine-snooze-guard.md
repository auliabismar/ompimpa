---
description: "Mewajibkan guard snooze pada Oban Smart Engine untuk menghindari busy loop (Hukum Besi #8d)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'snooze.*Oban'
  - 'Oban\.SmartEngine'
interruptMode: always
---

# Pelanggaran Hukum Besi #16: Oban Smart Engine Snooze Guard

Anda terdeteksi menggunakan SmartEngine tanpa guard snooze yang memadai.

### Mengapa Dilarang?
Tanpa snooze guard, job yang belum siap akan busy-loop dan menguras DB connections.

### Solusi Wajib:
```elixir
case result do
  {:snooze, 60} -> {:snooze, 60}
  {:ok, _} -> :ok
end
```
Pastikan `snooze` dipanggil dengan durasi eksplisit dan unique guard.
