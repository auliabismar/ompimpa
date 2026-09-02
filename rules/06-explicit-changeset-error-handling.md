---
description: "Mewajibkan penanganan eksplisit {:error, %Ecto.Changeset{}} di handler LiveView (Hukum Besi #19)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'case\s+[^=]+\.create_[a-zA-Z0-9_]+\([^\)]*\)\s+do[\s\n]+{:ok,\s*[^}]+}\s*->[\s\n]+{:noreply,[^}]+}[\s\n]+{:error,\s*_[a-zA-Z0-9_]*}\s*->'
  - 'case\s+[^=]+\.update_[a-zA-Z0-9_]+\([^\)]*\)\s+do[\s\n]+{:ok,\s*[^}]+}\s*->[\s\n]+{:noreply,[^}]+}[\s\n]+{:error,\s*_[a-zA-Z0-9_]*}\s*->'
interruptMode: always
---

# Pelanggaran Hukum Besi #6: Explicit Changeset Error Matching

Anda terdeteksi menangkap `{:error, _}` ambigu alih-alih `%Ecto.Changeset{}` spesifik.

### Mengapa Dilarang?
Wildcard menyamarkan error sistem fatal (DB crash) sebagai error validasi, menghilangkan feedback akurat.

### Solusi Wajib:
```elixir
case Accounts.create_user(params) do
  {:ok, user} -> {:noreply, push_navigate(socket, to: ~p"/users/#{user.id}")}
  {:error, %Ecto.Changeset{} = changeset} -> {:noreply, assign(socket, :form, to_form(changeset))}
end
```
