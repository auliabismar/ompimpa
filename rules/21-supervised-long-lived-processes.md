---
description: "Mencegah pembuatan proses asynchronous tanpa supervisi via Task.start/start_link/async (Hukum Besi #12)"
globs: ["*.ex", "*.exs"]
scope: "tool:edit(*.ex), tool:edit(*.exs), tool:write(*.ex), tool:write(*.exs)"
condition:
  - '\bTask\.(?:start|start_link|async)\s*\('
interruptMode: always
---

# Pelanggaran Hukum Besi #21: Supervise All Long-Lived Processes

Anda terdeteksi memanggil `Task.start/start_link/async` tanpa supervisi.

### Mengapa Dilarang?
Proses tanpa supervisor → crash tanpa terpantau, zombie leak, kaskade link.

### Solusi Wajib:
```elixir
Task.Supervisor.start_child(MyApp.TaskSupervisor, fn -> work() end)
Task.Supervisor.async_nolink(MyApp.TaskSupervisor, fn -> fetch() end)
# atau Oban untuk durability
```
