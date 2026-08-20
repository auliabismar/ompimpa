---
description: "Mencegah subscribe Phoenix.PubSub tanpa memeriksa status koneksi socket (Hukum Besi #5)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'def\s+mount\([^\)]*\)\s*do[\s\n]+(?:Phoenix\.)?PubSub\.subscribe\('
interruptMode: always
---

# Pelanggaran Hukum Besi #5: PubSub Connection Check

Anda terdeteksi memanggil `PubSub.subscribe/2` secara langsung tanpa memeriksa apakah WebSocket LiveView sudah tersambung (`connected?(socket)`).

### Mengapa Dilarang?
LiveView menjalankan fungsi `mount/3` dua kali:
1. **HTTP Initial Render (Disconnected):** Merender HTML statis untuk SEO dan respon cepat.
2. **WebSocket Mount (Connected):** Menginisialisasi koneksi stateful persisten.

Jika melakukan `PubSub.subscribe/2` pada render HTTP terputus, proses HTTP jangka pendek akan berlangganan topik dan segera mati tanpa unsubscribe, menimbulkan beban berlebih (*process churn/leak*) pada PubSub.

### Solusi Wajib:
Bungkus pemanggilan `PubSub.subscribe/2` di dalam kondisi `connected?(socket)`:
```elixir
def mount(_params, _session, socket) do
  if connected?(socket) do
    Phoenix.PubSub.subscribe(MyApp.PubSub, "topic:#{socket.assigns.current_user.id}")
  end

  {:ok, socket}
end
```
