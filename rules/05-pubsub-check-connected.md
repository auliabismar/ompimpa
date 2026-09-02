---
description: "Mencegah subscribe Phoenix.PubSub tanpa memeriksa status koneksi socket (Hukum Besi #5)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'def\s+mount\([^\)]*\)\s*do[\s\n]+(?:Phoenix\.)?PubSub\.subscribe\('
interruptMode: always
---

# Pelanggaran Hukum Besi #5: PubSub Connection Check

Anda terdeteksi memanggil `PubSub.subscribe/2` tanpa `connected?(socket)`.

### Mengapa Dilarang?
Mount dipanggil saat HTTP disconnected; subscribe di fase itu membuat process churn dan leak.

### Solusi Wajib:
```elixir
def mount(_params, _session, socket) do
  if connected?(socket) do
    Phoenix.PubSub.subscribe(MyApp.PubSub, "topic:#{socket.assigns.current_user.id}")
  end
  {:ok, socket}
end
```
