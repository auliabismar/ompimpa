# How-To: Menggunakan LiveView Streams untuk Daftar >100 Baris

> **Konteks:** Hukum Besi #3 (`03-mandatory-streams.md`) mewajibkan `stream/3` untuk daftar >100 baris (Hj. Rasuna Said).
> Deterministik dari `rules/03-mandatory-streams.md` + `graph.json`.

## Masalah

Render `<table>` dengan `@users` assign tanpa streams menyebabkan memory bloat (assigns tidak di-temporary) dan DOM patch O(N) di LiveView.

## Solusi: Streams (Boring & Benar)

```elixir
# live/user_live.ex
def mount(_params, _session, socket) do
  users = Accounts.list_users() # bisa 10k baris
  {:ok, stream(socket, :users, users)}
end

# heex
<div id="users" phx-update="stream">
  <div :for={{id, user} <- @streams.users} id={id}>
    <%= user.name %>
  </div>
</div>

# handle_event tambah
def handle_event("delete", %{"id" => id}, socket) do
  user = Accounts.get_user!(id)
  {:ok, _} = Accounts.delete_user(user)
  {:noreply, stream_delete(socket, :users, user)}
end
```

## Verifikasi

```bash
bun test test/prewalk_and_reviewer.test.ts # rule 03 streams
mix test test/*_live_test.exs
```

## Pitfalls Terdokumentasi (C-03)

- Jangan gunakan `assign(:users, list)` untuk >100 baris → gunakan `stream/3`.
- Pitfalls entry: `rules/pitfalls.md` bagian Streams, SOL-`liveview-streams`.
- Graph blast-radius: ubah `Accounts` → `_ompimpa/graph.json` list `live/*` terdampak.

---
*Generated: 2026-09-02T11:11:47.860Z — streams threshold 100 (ompimpa.toml stacks.liveview.stream_threshold_rows)*
