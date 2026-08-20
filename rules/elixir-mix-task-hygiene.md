---
description: "Mencegah eksekusi Mix.Task.run(\"app.start\") yang memicu restart runtime tidak aman (Hukum Besi #20)"
globs: ["*.ex", "*.exs"]
scope: "tool:edit(*.ex), tool:edit(*.exs), tool:write(*.ex), tool:write(*.exs)"
condition:
  - 'Mix\.Task\.run\(\s*["'']app\.start["'']\s*\)'
interruptMode: always
---

# Pelanggaran Hukum Besi #20: Mix Task Hygiene

Anda terdeteksi memanggil `Mix.Task.run("app.start")` di dalam skrip atau Mix Task.

### Mengapa Dilarang?
Memanggil task `app.start` secara rekursif di dalam Mix task dapat memicu kompilasi ulang ganda dan menginisialisasi dependensi aplikasi tanpa konfigurasi lingkungan yang bersih.

### Solusi Wajib:
Gunakan kombinasi `Mix.Task.run("app.config")` dan `Application.ensure_all_started/1`:
```elixir
Mix.Task.run("app.config")
{:ok, _} = Application.ensure_all_started(:my_app)
```
