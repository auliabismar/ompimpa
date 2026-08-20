---
description: "Mencegah penangkapan error changeset secara ambigu {:error, _} pada handler LiveView (Hukum Besi #19)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'case\s+[^=]+\.create_[a-zA-Z0-9_]+\([^\)]*\)\s+do[\s\n]+{:ok,\s*[^}]+}\s*->[\s\n]+{:noreply,[^}]+}[\s\n]+{:error,\s*_[a-zA-Z0-9_]*}\s*->'
  - 'case\s+[^=]+\.update_[a-zA-Z0-9_]+\([^\)]*\)\s+do[\s\n]+{:ok,\s*[^}]+}\s*->[\s\n]+{:noreply,[^}]+}[\s\n]+{:error,\s*_[a-zA-Z0-9_]*}\s*->'
interruptMode: always
---

# Pelanggaran Hukum Besi #19: Explicit Changeset Error Matching

Anda terdeteksi menangkap hasil gagal mutasi form menggunakan wildcard ambigu `{:error, _}` alih-alih mencocokkan `%Ecto.Changeset{}` secara spesifik.

### Mengapa Dilarang?
Ketika mutasi database gagal karena validasi form, Ecto mengembalikan `{:error, %Ecto.Changeset{}}` yang membawa pesan error field. Jika Anda menangkapnya dengan `{:error, _}`, Anda berisiko menyamarkan error sistem yang fatal (seperti kegagalan koneksi DB atau crash internal) sebagai error validasi biasa, sehingga LiveView form tidak dapat menampilkan feedback yang akurat ke pengguna.

### Solusi Wajib:
Tangkap `{:error, %Ecto.Changeset{} = changeset}` secara eksplisit:
```elixir
case Accounts.create_user(user_params) do
  {:ok, user} ->
    {:noreply, push_navigate(socket, to: ~p"/users/#{user.id}")}

  {:error, %Ecto.Changeset{} = changeset} ->
    {:noreply, assign(socket, :form, to_form(changeset))}
end
```
