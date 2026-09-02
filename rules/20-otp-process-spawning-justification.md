---
description: "Mencegah pembuatan GenServer/Agent tanpa justifikasi runtime konkurensi (Hukum Besi #11)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'defmodule.*use\s+GenServer'
interruptMode: always
---

# Pelanggaran Hukum Besi #20: No Process Without Runtime Reason

Anda terdeteksi membuat `GenServer`/`Agent` hanya untuk merapikan kode.

### Mengapa Dilarang?
Proses BEAM hanya untuk konkurensi, state runtime yang bermutasi, atau bottleneck antrean; selain itu gunakan modul murni.

### Solusi Wajib:
Dokumentasikan justifikasi: `@moduledoc "Runtime justification: concurrent queue for ..."` atau ganti dengan `Task.Supervisor` / ETS.
