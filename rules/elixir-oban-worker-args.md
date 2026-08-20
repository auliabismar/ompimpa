---
description: "Mencegah penggunaan atom keys pada argumen worker Oban perform/1 (Hukum Besi #8)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'def\s+perform\(%Oban\.Job\{args:\s*%\{[a-zA-Z0-9_]+:'
interruptMode: always
---

# Pelanggaran Hukum Besi #8: Oban Worker Job Argument Types

Anda terdeteksi melakukan pattern matching dengan *atom keys* pada `%Oban.Job{args: %{key: ...}}`.

### Mengapa Dilarang?
Oban meng-encode payload argumen pekerjaan sebagai JSON di database PostgreSQL. Saat payload di-decode oleh Oban worker runtime, seluruh key didecode menjadi **String Keys** (`%{"key" => value}`), bukan Atom Keys. Pattern matching atom keys akan selalu gagal dan menyebabkan job berulang kali crash (*infinite retry*).

### Solusi Wajib:
Selalu lakukan pattern matching menggunakan **String Keys**:
```elixir
@impl Oban.Worker
def perform(%Oban.Job{args: %{"user_id" => user_id, "amount" => amount}}) do
  # Logika idempotent di sini...
  :ok
end
```
