# Standar Batas Mutu OMP-IMPA (Quality Gates)

Setiap perubahan kode, PR, atau rilis story wajib lolos 4 gerbang mutu utama:

## 1. Gerbang Kompilasi & Format (Compiler Gate)
- `mix compile --warnings-as-errors`: Nol peringatan waktu kompilasi (*Zero Warnings*).
- `mix format --check-formatted`: Semua berkas Elixir terformat rapi sesuai standar resmi.

## 2. Gerbang Hukum Besi & Keamanan (Iron Law & Security Gate)
- Subagent `ompimpa-ironlaw` (Hj. Rasuna Said): Wajib berstatus **PASSED** (0 pelanggaran).
- Subagent `ompimpa-security` (Bagindo Azizchan): Bebas dari temuan tingkat `CRITICAL` atau `HIGH`.

## 3. Gerbang Pengujian TEA (Test Quality Gate)
- Subagent `ompimpa-test` (Tuanku Imam Bonjol):
  - Skor Scorecard Evaluasi Mutu Tes **wajib $\ge 90$** (dari skala 0–100).
  - 100% tes ExUnit dan LiveViewTest wajib berstatus hijau (**Green Phase**).

## 4. Gerbang Dokumentasi Diátaxis (Documentation Gate)
- Subagent `ompimpa-doc` (Mohammad Yamin):
  - Setiap Epic/Story yang selesai wajib memiliki pembaruan panduan Diátaxis di `docs/user/`, `docs/admin/`, atau `docs/dev/`.
