#!/usr/bin/env bash
# OMP-IMPA Git Pre-Commit Quality Guard
set -e

echo "🛡️ [OMP-IMPA] Menjalankan Pre-Commit Quality Gate..."

# 1. Pengecekan Cepat Pelanggaran Hukum Besi
echo "🔍 [1/3] Memindai pelanggaran Hukum Besi Elixir..."
if git diff --cached -S":float" -- lib/ | grep -E "amount|price|balance|total|uang|saldo|harga|fee" > /dev/null 2>&1; then
  echo "❌ [GAGAL] Hukum Besi #1 Dilanggar: Ditemukan tipe :float pada field keuangan/saldo!"
  echo "👉 Wajib gunakan :decimal atau integer sen."
  exit 1
fi

if git diff --cached | grep -E "String\.to_atom\(" > /dev/null 2>&1; then
  echo "❌ [GAGAL] Hukum Besi #9 Dilanggar: Ditemukan String.to_atom/1 pada kode baru!"
  echo "👉 Wajib gunakan String.to_existing_atom/1 atau whitelist map."
  exit 1
fi

# 2. Kompilasi Strict
echo "⚙️ [2/3] Memeriksa kompilasi strict (warnings as errors)..."
mix compile --warnings-as-errors

# 3. Format Kode
echo "✨ [3/3] Memeriksa format kode Elixir..."
mix format --check-formatted

echo "🏆 [OMP-IMPA] Pre-Commit Guard Lolos 100%!"
exit 0
