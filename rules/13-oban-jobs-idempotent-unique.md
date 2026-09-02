---
description: "Mewajibkan worker Oban idempotent dan unique jobs untuk mencegah duplikasi (Hukum Besi #8a)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'use\s+Oban\.Worker[^\n]*unique:'
interruptMode: always
---

# Pelanggaran Hukum Besi #13: Oban Jobs Idempotent Unique

Anda terdeteksi mendefinisikan Oban worker tanpa opsi `unique` atau tanpa idempotency guard.

### Mengapa Dilarang?
Tanpa unique constraint, job duplikat dapat ter-enqueue berkali-kali (mis. retry + user double-click), memicu double charge atau email ganda.

### Solusi Wajib:
```elixir
use Oban.Worker, queue: :default, unique: [period: 300, keys: [:user_id]]
def perform(%Oban.Job{args: %{"user_id" => id}}) do
  # idempotent: cek sudah diproses?
end
```
