---
description: "Mencegah eksekusi Mix.Task.run("app.start") yang memicu restart runtime tidak aman (Hukum Besi #20)"
globs: ["*.ex", "*.exs"]
scope: "tool:edit(*.ex), tool:edit(*.exs), tool:write(*.ex), tool:write(*.exs)"
condition:
  - 'Mix\.Task\.run\(\s*["'\'']app\.start["'\'']\s*\)'
interruptMode: always
---

# Pelanggaran Hukum Besi #24: Mix Task Hygiene

Anda terdeteksi memanggil `Mix.Task.run("app.start")`.

### Mengapa Dilarang?
Rekursif start memicu double compile dan init tanpa env bersih.

### Solusi Wajib:
```elixir
Mix.Task.run("app.config")
{:ok, _} = Application.ensure_all_started(:my_app)
```
