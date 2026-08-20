---
description: "Mencegah penggunaan tipe float untuk nilai mata uang, harga, diskon, atau saldo keuangan (Hukum Besi #1)"
globs: ["*.ex", "*.exs"]
scope: "tool:edit(*.ex), tool:edit(*.exs), tool:write(*.ex), tool:write(*.exs)"
condition:
  - 'field\s+:(?:price|amount|balance|cost|salary|fee|total|subtotal|discount|tax|rate|wage)[^,\n]*,[\s\n]*:float'
interruptMode: always
---

# Pelanggaran Hukum Besi #1: Presisi Keuangan & Numerik

Anda terdeteksi mendefinisikan kolom/field keuangan atau mata uang menggunakan tipe `:float`.

### Mengapa Dilarang?
Representasi floating-point IEEE-754 pada BEAM/Database menyebabkan *rounding errors* (misalnya `0.1 + 0.2 = 0.30000000000000004`), yang fatal untuk transaksi keuangan dan audit akuntansi.

### Solusi Wajib:
1. Gunakan tipe **`:decimal`** (didukung oleh `Decimal.t()`):
   ```elixir
   field :amount, :decimal
   ```
2. Atau gunakan representasi integer pada satuan terkecil (sen/rupiah murni):
   ```elixir
   field :amount_cents, :integer
   ```
3. Jika menggunakan library komposit: gunakan `Money.Ecto.Composite.Type`.
