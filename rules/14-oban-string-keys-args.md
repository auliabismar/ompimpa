---
description: "Mencegah penggunaan atom keys pada argumen worker Oban perform/1 (Hukum Besi #8b)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'def\s+perform\(%Oban\.Job\{args:\s*%\{[a-zA-Z0-9_]+:'
interruptMode: always
---

# Pelanggaran Hukum Besi #14: Oban String Keys Args

Anda terdeteksi pattern matching atom keys di `%Oban.Job{args: %{key: ...}}`.

### Mengapa Dilarang?
Oban encode JSON → decode jadi String keys. Atom keys selalu gagal, job infinite retry.

### Solusi Wajib:
```elixir
def perform(%Oban.Job{args: %{"user_id" => user_id}}) do
  :ok
end
```
