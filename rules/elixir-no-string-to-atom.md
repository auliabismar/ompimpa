---
description: "Mencegah konversi string dinamis ke atom via String.to_atom/1 untuk mencegah Atom DoS (Hukum Besi #9)"
globs: ["*.ex", "*.exs"]
scope: "tool:edit(*.ex), tool:edit(*.exs), tool:write(*.ex), tool:write(*.exs)"
condition:
  - 'String\.to_atom\('
interruptMode: always
---

# Pelanggaran Hukum Besi #9: Atom Exhaustion DoS

Anda terdeteksi memanggil fungsi `String.to_atom/1`.

### Mengapa Dilarang?
Tabel atom pada BEAM VM bersifat **global dan tidak pernah di-*garbage collect***. Nilai atom maksimum dibatasi (default ~1.048.576). Jika masukan dari luar/pengguna dikonversi menjadi atom dinamis menggunakan `String.to_atom/1`, penyerang dapat membanjiri sistem dengan string acak hingga tabel atom penuh, menyebabkan **seluruh BEAM node crash seketika**.

### Solusi Wajib:
1. Jika atom sudah dipastikan ada di sistem (misal memetakan field schema yang diketahui):
   ```elixir
   String.to_existing_atom(param)
   ```
2. Atau gunakan pemetaan eksplisit (*whitelist map*):
   ```elixir
   case param do
     "admin" -> {:ok, :admin}
     "member" -> {:ok, :member}
     _ -> {:error, :invalid_role}
   end
   ```
3. Atau pertahankan nilai dalam bentuk string murni.
