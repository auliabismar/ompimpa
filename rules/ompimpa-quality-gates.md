# Standar Batas Mutu OMP-IMPA (Quality Gates)

Setiap perubahan kode, PR, atau rilis story wajib lolos arsitektur batas mutu berlapis:

## 0. Gerbang Waktu-Nyata TTSR (Tier 0: Real-Time Stream Guard)
- **Engine OMP TTSR**: Memantau buffer streaming toolcalls (`edit`/`write`) secara waktu-nyata.
- Pelanggaran pola sintaksis (uang `:float`, `String.to_atom`, `raw/1` XSS, PubSub tanpa `connected?`) langsung di-abort dan di-rollback seketika sebelum baris kode tersimpan di disk.

## 1. Gerbang Kompilasi & Format (Compiler Gate)
- `mix compile --warnings-as-errors`: Nol peringatan waktu kompilasi (*Zero Warnings*).
- `mix format --check-formatted`: Semua berkas Elixir terformat rapi sesuai standar resmi.

## 2. Gerbang Hukum Besi Semantik & Keamanan (Semantic Iron Law & Security Gate)
- Subagent `ompimpa-ironlaw` (Hj. Rasuna Said): Wajib berstatus **PASSED** (0 pelanggaran arsitektur, supervisi proses, dan otorisasi socket).
- Subagent `ompimpa-security` (Bagindo Azizchan): Bebas dari temuan tingkat `CRITICAL` atau `HIGH`.
## 3. Gerbang Pengujian TEA (Test Quality Gate)
- Subagent `ompimpa-test` (Tuanku Imam Bonjol):
  - Skor Scorecard Evaluasi Mutu Tes **wajib $\ge 90$** (dari skala 0–100).
  - 100% tes ExUnit dan LiveViewTest wajib berstatus hijau (**Green Phase**).

## 4. Gerbang Dokumentasi Diátaxis (Documentation Gate)
- Subagent `ompimpa-doc` (Mohammad Yamin):
  - Setiap Epic/Story yang selesai wajib memiliki pembaruan panduan Diátaxis di `docs/user/`, `docs/admin/`, atau `docs/dev/`.
