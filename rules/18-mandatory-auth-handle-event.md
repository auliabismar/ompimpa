---
description: "Mewajibkan verifikasi otorisasi di setiap handle_event/3 LiveView (Hukum Besi #2)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'def\s+handle_event\([^)]*\)[\s\S]*?authorize!?'
interruptMode: always
---

# Pelanggaran Hukum Besi #18: LiveView Socket Authorization

Anda terdeteksi `handle_event/3` tanpa verifikasi otorisasi eksplisit.

### Mengapa Dilarang?
Hanya memeriksa di `mount/3` membuka IDOR via event replay; setiap event harus authorize.

### Solusi Wajib:
```elixir
def handle_event("delete", %{"id" => id}, socket) do
  with :ok <- Bodyguard.permit(MyApp.Posts, :delete, socket.assigns.current_user, id) do
    {:noreply, socket}
  else
    {:error, :unauthorized} -> {:noreply, put_flash(socket, :error, "Unauthorized")}
  end
end
```
