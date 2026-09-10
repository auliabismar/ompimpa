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
enable_spec_review = true        # Review Fungsional: Audit Source Code vs AC PRD (4 lens BMAD saat bmad_lens_count=4)
enable_tech_review = true        # Review Teknis: Audit Kepatuhan Teknis Elixir/Phoenix (Panel 6 Spesialis)
bmad_lens_count = 4              # Total panel 10 (4 BMAD + 6 tech); 3 = tanpa completeness lens
parallel_reviewers = 6         # Panel 6 subagent paralel: IronLaw, Security, QA/Test, Compiler, Ecto/Ash, LiveView/Oban (total 10 dengan 4 lens BMAD)
max_triage_fix_cycles = 3      # [v2 ADR-001] Batas siklus perbaikan otomatis sebelum eskalasi (was 2, sinkron agyimpa 3)
scoring_weights = { Critical = 30, High = 15, Medium = 5, Low = 2 } # [v2] port agyimpa criteria_registry_35.json
allow_p2_nits = false          # [v2] P2 Low tetap BLOCK (was allow), sinkron agyimpa allow_p2_nits=false

[quality.triage]
enable_mini_balairung = true    # Adjudikasi sengketa temuan Tier 2.5 single-shot model smol
adjudication_timeout_ms = 30000 # Batas waktu eksekusi adjudikasi single-shot (ms)
adjudication_model = "smol"     # Model arbiter mini-balairung

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
steps = ["test --stale"] # + reviewers + triage 100/100 (B-01/B-02)
[quality.verify.tier3] # Background Audit — non-blocking
steps = ["test", "credo --strict", "sobelow --strict --format json"]

# Kill criteria per story (A-02) — dirujuk dari _ompimpa/stories.yaml kill_criteria
[stories]
kill_criteria_cache = "_ompimpa/.cache/dag.json" # Jika DAG check >500ms di 100 story → cache

# ==========================================
# Manajemen Sumber Daya & Worktree
# ==========================================
[resources]
use_git_worktrees = true       # Eksekusi task paralel di Git Worktree terisolasi (~/.omp/wt/)

# ==========================================
# Harness Headless (dipakai ompimpa dev --epic --auto)
# ==========================================
[harness]
binary = "omp"                   # Biner harness yang di-spawn per fase code/review
#model_dev = "default"           # Model sesi DEV (fuzzy match); kosong = default sesi
#model_review = "default"        # Model sesi REVIEW; kosong = default sesi
#session_timeout_ms = 600000    # Timeout per sesi harness
# Pemetaan Model Subagent (Terkoneksi ke OMP Roles)
# ==========================================
[models]
balairung = "slow"              # Dewan Tokoh Balairung (3-Round Deliberation & Dialectics)
ideate = "slow"                # Rohana Kudus & Tan Malaka (Deep TRIZ & First Principles)
prd = "plan"                   # H. Agus Salim (Master PRD & Architecture Planning)
adr = "plan"                   # H. Agus Salim (Architecture Decision Records)
ui = "vision"                  # Marah Rusli (HEEx, Tailwind & Google Stitch Design)
test = "default"               # Tuanku Imam Bonjol (Red-Phase ATDD Scaffolding)
dev = "default"                # Backend Specialists (Ash, LiveView, Ecto, Oban, OTP)
commit = "smol"               # Generator Semantic Commit Message (feat/fix/test/refactor)
ironlaw = "smol"               # Hj. Rasuna Said (Fast & deterministic Iron Law verification)
security = "slow"              # Bagindo Azizchan (Deep perimeter security & vulnerability audit)
debug = "slow"                 # Adinegoro (4-track deep root cause investigation)
doc = "default"                # Mohammad Yamin (Diátaxis User, Admin, Dev Guides)
triage = "smol"                 # Hakim Adjudikasi Mini Balairung Tier 2.5 (Adjudikasi Sengketa Triage)
# ==========================================
# Pilihan Stack Modular
# ==========================================
[stacks]
use_ash_framework = false       # Auto-detect dari mix.exs (:ash); override CLI --ash/--no-ash (repo ini: false)
use_oban = false                # Auto-detect dari mix.exs (:oban); override CLI --oban/--no-oban (repo ini: false)
use_tailwind = true            # Auto-detect dari mix.exs (:tailwind)

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
