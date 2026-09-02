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
## Standar Mutu & Pengujian
---
[quality]
enable_atdd = true             # Wajibkan tes merah Red-Phase sebelum koding
quality_score_floor = 100      # [v2 ADR-001] Skor minimal kelulusan review 100/100 (was 90)
scoring_version = "v2"         # [v2] v1=legacy 90/-25/-10/-3, v2=deterministik 100/-30/-15/-5/-2
warnings_as_errors = true      # Enforce mix compile --warnings-as-errors
max_dev_retries = 3            # Circuit breaker OTP: eskalasi ke manusia jika 3x gagal (sinkron agyimpa max_retries_per_story=3)
auto_macro_review_in_dev = true# Jalankan review otomatis sebelum commit di akhir setiap story
auto_triage_and_fix = true     # Triage otomatis temuan Blocker & Warning sebelum commit

[quality.review]
enable_spec_review = true        # Review Fungsional: Audit Source Code vs AC PRD (akan di-split 3/4 lens di B-03)
enable_tech_review = true        # Review Teknis: Audit Kepatuhan Teknis Elixir/Phoenix (Panel 6 Spesialis)
parallel_reviewers = 6         # Panel 6 subagent paralel: IronLaw, Security, QA/Test, Compiler, Ecto/Ash, LiveView/Oban (total 7 dengan spec, 10 dengan BMAD 4 lens)
max_triage_fix_cycles = 3      # [v2 ADR-001] Batas siklus perbaikan otomatis sebelum eskalasi (was 2, sinkron agyimpa 3)
scoring_weights = { Critical = 30, High = 15, Medium = 5, Low = 2 } # [v2] port agyimpa criteria_registry_35.json
allow_p2_nits = false          # [v2] P2 Low tetap BLOCK (was allow), sinkron agyimpa allow_p2_nits=false
# Target Non-Functional Requirements (NFR)
[quality.nfr]
target_p95_latency_ms = 50     # Target latensi respons p95 (ms) pada naskah PRD

# Langkah-Langkah Verifikasi Otomatis — [v2 ADR-001] Tiered T1<2s/T2<10s/T3 background (B-04)
[quality.verify]
steps = [
  "compile --warnings-as-errors",
  "format --check-formatted",
  "test"
]
[quality.verify.tier1] # Inner Loop <2s — blocking per story
steps = ["compile --warnings-as-errors", "format --check-formatted"]
[quality.verify.tier2] # Per-Story Gate <10s — blocking per story
steps = ["test --stale"] # + 7 reviewers + triage 100/100 (B-01/B-02)
[quality.verify.tier3] # Background Audit — non-blocking
steps = ["test", "credo --strict", "sobelow --strict --format json"]

# ==========================================
# Manajemen Sumber Daya & Worktree
# ==========================================
[resources]
use_git_worktrees = true       # Eksekusi task paralel di Git Worktree terisolasi (~/.omp/wt/)
# Pemetaan Model Subagent (Terkoneksi ke OMP Roles)
# ==========================================
[models]
balairung = "slow"              # Dewan Tokoh Balairung (3-Round Deliberation & Dialectics)
ideate = "slow"                # Rohana Kudus & Tan Malaka (Deep TRIZ & First Principles)
prd = "plan"                   # H. Agus Salim (Master PRD & Architecture Planning)
adr = "plan"                   # H. Agus Salim (Architecture Decision Records)
ui = "design"                  # Marah Rusli (HEEx, Tailwind & Google Stitch Design)
test = "default"               # Tuanku Imam Bonjol (Red-Phase ATDD Scaffolding)
dev = "default"                # Backend Specialists (Ash, LiveView, Ecto, Oban, OTP)
commit = "smol"               # Generator Semantic Commit Message (feat/fix/test/refactor)
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
enable_compound_memory = true  # Indeks dan simpan pola solusi di _ompimpa/solutions/
# ==========================================
# Verifikasi Runtime & UI
# ==========================================
[runtime_verification]
browser_e2e = true             # Buka Headless Chromium untuk verifikasi visual jalur kritis
in_process_liveview = true     # Jalankan Phoenix.LiveViewTest in-process (~5ms)
```
