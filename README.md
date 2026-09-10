# OMP-IMPA (`ompimpa`)

> **Integrated Modular Phoenix Architecture for Oh My Pi (`omp`)**  
> *Menyatukan Daya Pikir Produk BMAD (BMM + CIS + TEA), Keahlian Domain Elixir/Phoenix (phxagents), dan Mesin Eksekusi Paralel Native OMP.*

---

📖 **Dokumentasi Resmi Diátaxis:** Kunjungi **[Portal Dokumentasi OMP-IMPA (`docs/index.md`)](docs/index.md)** untuk panduan lengkap (*Tutorials, How-To Guides, Reference, dan Explanation*).

---

## 1. Executive Summary

`ompimpa` adalah plugin tata kelola produk AI-native dan rekayasa otonom untuk aplikasi Phoenix yang berjalan di atas Oh My Pi (`omp`).

Plugin ini mengintegrasikan 3 pilar besar:
1. **BMAD Method**:
   - **CIS (Creative Intelligence)**: Musyawarah Meja Bundar (*Party Mode*) & Elicitation bersama Rohana Kudus (SCAMPER) dan Tan Malaka (TRIZ/Madilog).
   - **BMM (Breakthrough Method Core)**: Master PRD, Epics & Slices Spine, dan Architecture Decision Records (ADRs) bersama H. Agus Salim.
   - **TEA (Test Architecture Enterprise)**: Matriks Risiko P1-P4, Red-Phase ATDD, dan Scorecard Mutu 100/100 (v2: -30/-15/-5/-2, PASS hanya 100) bersama Tuanku Imam Bonjol.
2. **phxagents Specialist Layer & 26 Iron Laws**:
   - Spesialis domain mendalam: Ash, LiveView, Ecto, Oban, dan OTP.
   - 26 Hukum Besi Elixir non-negotiable yang otomatis diaudit oleh Hj. Rasuna Said.
   - Audit keamanan perimeter oleh Bagindo Azizchan.
   - Investigasi bug mendalam oleh Djamaluddin Adinegoro.
   - Dokumentasi terstruktur 4 kuadran Diátaxis (User, Admin, Dev) oleh Mohammad Yamin.
3. **OMP Native Execution Engine & Multi-Tier Guard**:
   - **Tier 0**: TTSR Real-Time Stream Rules (`rules/elixir-*.md`) untuk interupsi dini saat LLM mengetik.
   - **Tier 1**: OMP Runtime Guard Hook (`hooks/ompimpa-guard.ts`) untuk memblokir bypass `--no-verify` dan memadatkan output tes.
   - **Tier 2**: Fast Git Pre-Commit Gate (`.git/hooks/pre-commit`) sub-2-detik (diff scan + compile + format).
   - **Tier 3**: Panel Review 10 subagent terisolasi (4 BMAD + 6 Tech, `bmad_lens_count = 4`, `parallel_reviewers = 6`) (`/ompimpa:review`) dan Full Verification Suite (`/ompimpa:verify`).
   - Konkurensi DAG subagent hingga 32 subagent paralel (`task`) & isolasi Git Worktrees.

---

## 2. Siklus Hidup 6-Tahap Terpadu (Unified Lifecycle)

```
┌─── [SESI 1: DISCOVERY & DESAIN PRODUK] ───────────────────────────┐
│ 0. Deliberasi Balairung───>  /ompimpa:balairung(3-Ronde Dialektika)│
│ 1. Ideasi & Musyawarah  ───>  /ompimpa:ideate  (SCAMPER & TRIZ)   │
│ 2. Spesifikasi & ADR    ───>  /ompimpa:prd     (Master PRD Spine) │
│                               /ompimpa:adr     (MADR 3.0+ Record) │
│ 3. Desain Visual & UX   ───>  /ompimpa:ui      (HEEx & Tailwind)  │
└───────────────────────────────────────────────────────────────────┘
                                  │
                [SIMPAN STATE DISK & SESI BARU]
                                  ▼
┌─── [SESI 2: ENGINEERING & DEV OTONOM] ────────────────────────────┐
│ 4. Eksekusi Koding      ───>  /ompimpa:dev     (Otomatis ATDD Merah│
│                                                 -> Koding Hijau   │
│                                                 -> Review 6-Jalur │
│                                                 -> Auto-Commit)   │
│    (Opsional Standalone)───>  /ompimpa:atdd    (Scaffold Tes Saja)│
│ 5. Review & Verifikasi  ───>  /ompimpa:review  (Panel 10: 4 BMAD + 6 Tech)│
│                               /ompimpa:verify  (Full Tests Gate)  │
│ 6. Dokumentasi Diátaxis ───>  /ompimpa:doc     (User/Admin/Dev)   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. Daftar 14 Core Subagents (`agents/`)

| Nama Subagent | Tokoh Inspirasi Minangkabau | Keahlian & Tanggung Jawab |
| :--- | :--- | :--- |
| `ompimpa-ideate.md` | [**Rohana Kudus**](https://id.wikipedia.org/wiki/Ruhana_Kuddus) | Curah pendapat SCAMPER, pemetaan empati, dan How Might We (HMW). |
| `ompimpa-triz.md` | [**Tan Malaka**](https://id.wikipedia.org/wiki/Tan_Malaka) | Resolusi kontradiksi teknis, logika First Principles, dan *Madilog*. |
| `ompimpa-prd.md` | [**H. Agus Salim**](https://id.wikipedia.org/wiki/Agus_Salim) | Master PRD, Epics & Stories Spine, serta naskah ADR berstandar MADR. |
| `ompimpa-ui.md` | [**Marah Rusli**](https://id.wikipedia.org/wiki/Marah_Roesli) | Komponen HEEx, styling Tailwind CSS responsif, dan CoreComponents. |
| `ompimpa-test.md` | [**Tuanku Imam Bonjol**](https://id.wikipedia.org/wiki/Tuanku_Imam_Bonjol) | Matriks risiko P1-P4, Red-Phase ATDD, dan Scorecard Mutu $\ge 90$. |
| `ompimpa-ash.md` | [**Mr. Assaat**](https://id.wikipedia.org/wiki/Assaat) | Resources Ash deklaratif, Actions, Kebijakan *Fail-Closed*, dan Query. |
| `ompimpa-liveview.md`| [**Tuanku Tambusai**](https://id.wikipedia.org/wiki/Tuanku_Tambusai) | Lifecycle socket, optimasi memori Streams, JS Hooks, dan PubSub. |
| `ompimpa-ecto.md` | [**Mohammad Hatta**](https://id.wikipedia.org/wiki/Mohammad_Hatta) | Skema database, changeset, constraint, migrasi aman, dan `Ecto.Multi`. |
| `ompimpa-oban.md` | [**Djamaluddin Tamin**](https://id.wikipedia.org/wiki/Djamaluddin_Tamin) | Background worker idempotent, antrean unik, dan penjadwalan cron. |
| `ompimpa-otp.md` | [**Sutan Sjahrir**](https://id.wikipedia.org/wiki/Sutan_Sjahrir) | Tata kelola BEAM, Supervision Tree, dan isolasi proses. |
| `ompimpa-ironlaw.md` | [**Hj. Rasuna Said**](https://id.wikipedia.org/wiki/Rasuna_Said) | Hakim penegak 26 Hukum Besi Elixir pada setiap diff kode. |
| `ompimpa-security.md`| [**Bagindo Azizchan**](https://id.wikipedia.org/wiki/Bagindo_Azizchan) | Benteng keamanan perimeter (CSRF, XSS, Atom DoS, Safe Params, Hex). |
| `ompimpa-debug.md` | [**Djamaluddin Adinegoro**](https://id.wikipedia.org/wiki/Djamaluddin_Adinegoro) | Investigasi bug mendalam, analisis akar masalah (RCA), dan call tracer. |
| `ompimpa-doc.md` | [**Mohammad Yamin**](https://id.wikipedia.org/wiki/Mohammad_Yamin) | Dokumentasi terstruktur 4 kuadran Diátaxis (User, Admin, Dev Guides). |

👉 *Detail filosofi dan karakteristik tiap tokoh tersedia di **[Roster Subagents (`docs/reference/subagents-roster.md`)](docs/reference/subagents-roster.md)**.*

---

## 4. Konfigurasi Modularitas (`ompimpa.toml`)

```toml
# ompimpa.toml (Target Project Configuration)
[project]
name = "mimar"
[locale]
communication_language = "id"    # Bahasa agen saat berdiskusi di chat ("id" | "en")
document_output_language = "id"  # Bahasa dokumen resmi PRD, ADR, dan Diátaxis ("id" | "en")

[governance]
enable_party_mode = true         # Aktifkan musyawarah meja bundar saat ideasi (/ompimpa:ideate)
enable_prd_adr = true            # Aktifkan penyusunan Master PRD dan MADR ADR
artifacts_dir = "_ompimpa"       # Direktori penyimpanan artefak internal PRD, ADR, dan status

[quality]
enable_atdd = true               # Wajibkan tes merah Red-Phase sebelum koding
quality_score_floor = 100        # [v2 ADR-001] Skor mutlak 100/100 (-30/-15/-5/-2), PASS hanya 100
scoring_version = "v2"           # v1 legacy 90/-25/-10/-3, v2 deterministik 100/-30/-15/-5/-2 + dedup hash
warnings_as_errors = true        # mix compile --warnings-as-errors
max_dev_retries = 3              # Circuit breaker: eskalasi ke manusia jika 3x gagal tes beruntun (sinkron max_retries_per_story=3)
auto_macro_review_in_dev = true  # Jalankan review otomatis sebelum commit di akhir setiap story
auto_triage_and_fix = true       # Otomatis triage temuan P0/P1 dan perbaiki sebelum commit final

[quality.review]
enable_spec_review = true        # Review fungsional vs AC PRD (4 lens BMAD saat bmad_lens_count=4)
enable_tech_review = true        # Review teknis 6 spesialis
bmad_lens_count = 4              # 4 lens BMAD → total panel 10 (4 spec + 6 tech)
parallel_reviewers = 6           # Panel 6 tech paralel (ironlaw, security, test, verify, ash/ecto, liveview/oban)
max_triage_fix_cycles = 3        # Batas siklus perbaikan otomatis sebelum eskalasi
scoring_weights = { Critical = 30, High = 15, Medium = 5, Low = 2 } # Port criteria_registry_35.json
allow_p2_nits = false            # P2 Low tetap BLOCK

[quality.nfr]
target_p95_latency_ms = 50       # Target latensi respons p95 (ms) pada naskah PRD

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

# Kill criteria per story (A-02)
[stories]
kill_criteria_cache = "_ompimpa/.cache/dag.json"

[resources]
use_git_worktrees = true         # Eksekusi task paralel di Git Worktree terisolasi (~/.omp/wt/)
[models]
ideate = "slow"                  # Rohana Kudus & Tan Malaka (Deep TRIZ & First Principles)
prd = "plan"                     # H. Agus Salim (Master PRD & Architecture Planning)
adr = "plan"                     # H. Agus Salim (Architecture Decision Records)
ui = "vision"                   # Marah Rusli (HEEx, Tailwind & Google Stitch Design)
test = "default"                 # Tuanku Imam Bonjol (Red-Phase ATDD Scaffolding)
dev = "default"                  # Backend Specialists (Ash, LiveView, Ecto, Oban, OTP)
commit = "smol"                 # Generator Semantic Commit Message (feat/fix/test/refactor)
ironlaw = "smol"                 # Hj. Rasuna Said (Fast & deterministic Iron Law verification)
security = "slow"                # Bagindo Azizchan (Deep perimeter security & vulnerability audit)
debug = "slow"                   # Adinegoro (4-track deep root cause investigation)
doc = "default"                  # Mohammad Yamin (Diátaxis User, Admin, Dev Guides)

[stacks]
use_ash_framework = false     # Auto-detect dari mix.exs (:ash); override via --ash/--no-ash
use_oban = false              # Auto-detect dari mix.exs (:oban); override via --oban/--no-oban
use_tailwind = true          # Auto-detect dari mix.exs (:tailwind)

[stacks.liveview]
stream_threshold_rows = 100      # Batas jumlah baris data sebelum wajib menggunakan LiveView Streams

[documentation]
diataxis_format = true           # Terapkan standar 4 kuadran Diátaxis di folder docs/
output_dir = "docs"              # Target folder untuk dokumentasi Diátaxis resmi proyek

[tools]
enable_compound_memory = true    # Simpan dan indeks solusi teruji di _ompimpa/solutions/
[runtime_verification]
browser_e2e = true               # Buka Chromium untuk verifikasi visual jalur kritis
in_process_liveview = true       # Jalankan Phoenix.LiveViewTest in-process
```

---

## 5. Quick Start & Perintah Utama

### 1. Pasang Plugin OMP-IMPA
Pilih salah satu cara pemasangan berikut:
```bash
# Opsi A: Instalasi Langsung via Git (Direkomendasikan — 1 Perintah)
omp plugin install github:auliabismar/ompimpa

# Opsi B: Instalasi via OMP Marketplace
omp plugin marketplace add auliabismar/ompimpa
omp plugin install ompimpa@ompimpa

# Opsi C: Local Link (Untuk Pengembangan / Kontributor)
git clone https://github.com/auliabismar/ompimpa.git && cd ompimpa && omp plugin link .
```

### 2. Inisialisasi di Proyek Phoenix Target
```bash
cd /path/to/my_phoenix_app
ompimpa init
ompimpa doctor
```

### 3. Slash Commands di Sesi OMP (19 file di `commands/`)
* `/ompimpa:balairung [topik]` — Sidang musyawarah 3-ronde (Blind, Debat, Verdict) bersama dewan tokoh.
* `/ompimpa:ideate [ide]` — Memulai musyawarah ideasi & resolusi TRIZ.
* `/ompimpa:prd [judul]` — Menyusun Master PRD & Epics Spine.
* `/ompimpa:adr [keputusan]` — Mencatat keputusan arsitektur MADR 3.0+ di `_ompimpa/adr/`.
* `/ompimpa:ui [komponen]` — Merancang HEEx, Tailwind, Google Stitch UI prompt, dan preview Chromium.
* `/ompimpa:story <ID>` — Scaffolding spesifikasi mikro JIT (`_ompimpa/specs/SPEC-[ID].md`).
* `/ompimpa:atdd <ID>` — Merancang matriks risiko dan scaffold tes merah secara mandiri.
* `/ompimpa:code <ID>` — Implementasi koding hijau terisolasi per story.
* `/ompimpa:review <ID> [--staged]` — Panel review 10 subagent terisolasi (4 BMAD + 6 Tech).
* `/ompimpa:triage <ID>` — Deduplikasi `file:line:ruleId`, scoring 100/100, remediation plan.
* `/ompimpa:dev [--epic <ID>] [--story <ID>] [--auto]` — Loop dev otonom (JIT Spec → ATDD → Code → 10-Review → Triage → Commit).
* `/ompimpa:course-correct` — Menyelaraskan kembali PRD & rencana saat terjadi pivot.
* `/ompimpa:graphify [--blast <file>]` — Graf dependensi `_ompimpa/graph.json` + `graph.html`.
* `/ompimpa:verify` — Tiered verify T1+T2 blocking (`--tier1/--tier2/--tier3/--all`), strict compiler suite.
* `/ompimpa:doc` — CLI `ompimpa doc` generate 4 kuadran Diátaxis di `docs/` (slash `/doc user --epic 8` via ompimpa-doc).
* `/ompimpa:inspect [--boundaries|--perf|--security|--docs|--dry-run]` — Master diagnostic 4-pilar out-of-band & auto-triage EPIC-DEBT (unifikasi audit, boundaries, perf, techdebt).
* `/ompimpa:prewalk [paths]` — Scan AST/regex 26 Iron Laws + TTSR stream rules.
* `/ompimpa:doctor` — Diagnosa toolchain & konfigurasi repo.
* `/ompimpa:compound [topik]` — Menyimpan pola solusi teruji di `_ompimpa/solutions/`.

### 4. CLI Terminal OS (`bin/ompimpa`, 19 perintah di `src/cli.ts`)
* `init [--force] [--ash|--no-ash] [--oban|--no-oban]` — Scaffold Greenfield/Brownfield + `ompimpa.toml`.
* `doctor` — Cek mix.exs, ompimpa.toml, feature-status, AGENTS.md, hooks, agents sync, Diátaxis, rules, manifests, toolchain.
* `verify [--tier1|--tier2|--tier3|--all]` — Default T1+T2 blocking, T3 background.
* `dev [--epic <ID>] [--story <ID>] [--auto] [--no-harness]` — DAG validate + 5 fase per story.
* `story <ID> [--dry-run] [--force]` → `ready-for-atdd`; `atdd <ID>` → `ready-for-dev`; `code <ID>`; `review <ID>`; `triage <ID> [--strict] [--json]`.
* `status [<story-id>]` — Inspeksi kanonis story lifecycle (backlog → done), verifikasi SPEC, berkas uji, bukti review, triage verdict, dan git history.
* `tui [--show-thinking] [--fps <n>]` — Dashboard terminal interaktif (EPIC-F) pemantau kanban stories, spec JIT, dan live stream kegiatan subagent.
* `inventory --balairung <file> [--prd <file>] [--stories <file>]` — Gerbang inventaris anti scope-truncation (INV-10).
* `graphify [--blast <file>]`, `sweep [--dry-run]`, `doc`, `inspect`, `prewalk`, `sync`, `link`, `version/help`.
---

## 6. License
MIT License.
