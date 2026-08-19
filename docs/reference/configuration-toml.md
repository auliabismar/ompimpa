# Referensi: Spesifikasi Konfigurasi `ompimpa.toml`

Dokumen referensi ini menjelaskan setiap parameter yang dapat dikonfigurasi pada berkas `ompimpa.toml` di direktori root proyek Anda.

---

## Skema Konfigurasi Lengkap

```toml
# ==========================================
# Identitas Proyek
# ==========================================
[project]
name = "mimar"                 # Nama proyek Phoenix target
framework = "phoenix"          # Target framework

# ==========================================
# Pengaturan Dwi-Bahasa (Dual-Locale)
# ==========================================
[locale]
communication_language = "id"  # Bahasa interaksi di chat/terminal ("id" | "en")
document_output_language = "id"# Bahasa naskah resmi PRD/ADR/Docs ("id" | "en")

# ==========================================
# Tata Kelola Produk & Ideasi
# ==========================================
[governance]
enable_party_mode = true       # Musyawarah multi-persona saat ideasi (/ompimpa:ideate)
enable_prd_adr = true          # Pembuatan Master PRD dan ADR otomatis
artifacts_dir = "_ompimpa"     # Direktori penyimpanan artefak internal PRD, ADR, dan status

# ==========================================
# Standar Mutu & Pengujian
# ==========================================
[quality]
enable_atdd = true             # Wajibkan tes merah Red-Phase sebelum koding
quality_score_floor = 90       # Skor minimal kelulusan review (0-100)
warnings_as_errors = true      # Enforce mix compile --warnings-as-errors
max_dev_retries = 3            # Batas retry loop sebelum circuit breaker eskalasi ke manusia
auto_macro_review_in_dev = true# Jalankan Macro-Review 4-jalur otomatis di sesi dev
auto_triage_and_fix = true     # Triage otomatis temuan Blocker & Warning sebelum commit

# Target Non-Functional Requirements (NFR)
[quality.nfr]
target_p95_latency_ms = 50     # Target latensi respons p95 (ms) pada naskah PRD

# Langkah-Langkah Verifikasi Otomatis
[quality.verify]
steps = [
  "compile --warnings-as-errors",
  "format --check-formatted",
  "test"
]

# ==========================================
# Manajemen Sumber Daya Mesin & Konkurensi
# ==========================================
[resources]
max_concurrency = 2            # Batas maksimal subagent kompilasi paralel (mencegah lonjakan RAM/CPU)
use_git_worktrees = true       # Eksekusi task paralel di Git Worktree terisolasi (~/.omp/wt/)
shared_lsp_server = true       # Gunakan 1 instance LSP bersama untuk seluruh subagent

# ==========================================
# Pemetaan Model Subagent (Terkoneksi ke OMP Roles)
# ==========================================
[models]
ideate = "slow"                # Rohana Kudus & Tan Malaka (Deep TRIZ & First Principles)
prd = "plan"                   # H. Agus Salim (Master PRD & Architecture Planning)
adr = "plan"                   # H. Agus Salim (Architecture Decision Records)
ui = "default"                 # Marah Rusli (HEEx & Tailwind CSS Visual Design)
test = "default"               # Tuanku Imam Bonjol (Red-Phase ATDD Scaffolding)
dev = "default"                # Backend Specialists (Ash, LiveView, Ecto, Oban, OTP)
ironlaw = "smol"               # Hj. Rasuna Said (Fast & deterministic Iron Law verification)
security = "slow"              # Bagindo Azizchan (Deep perimeter security & vulnerability audit)
debug = "slow"                 # Adinegoro (4-track deep root cause investigation)
doc = "default"                # Mohammad Yamin (Diátaxis User, Admin, Dev Guides)

# ==========================================
# Pilihan Stack Modular
# ==========================================
[stacks]
use_ash_framework = true       # Set false jika menggunakan Vanilla Phoenix + Ecto
use_oban = true                # Set false jika tidak menggunakan background jobs Oban
use_tailwind = true            # Set false jika tidak menggunakan Tailwind CSS

[stacks.liveview]
stream_threshold_rows = 100    # Batas jumlah baris data sebelum wajib menggunakan LiveView Streams

# ==========================================
# Dokumentasi Berstandar Diátaxis
# ==========================================
[documentation]
diataxis_format = true         # Terapkan pengelompokan 4 kuadran Diátaxis di folder docs/
output_dir = "docs"            # Target folder untuk dokumentasi Diátaxis resmi proyek

# ==========================================
# Alat Tambahan & Memori Institusional
# ==========================================
[tools]
enable_tidewave = true         # Aktifkan Tidewave MCP untuk inspeksi runtime BEAM live
enable_compound_memory = true  # Indeks dan simpan pola solusi di _ompimpa/solutions/

# ==========================================
# Verifikasi Runtime & UI
# ==========================================
[runtime_verification]
browser_e2e = true             # Buka Headless Chromium untuk verifikasi visual jalur kritis
in_process_liveview = true     # Jalankan Phoenix.LiveViewTest in-process (~5ms)
```
