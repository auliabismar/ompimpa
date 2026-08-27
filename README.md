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
   - **TEA (Test Architecture Enterprise)**: Matriks Risiko P1-P4, Red-Phase ATDD, dan Scorecard Mutu $\ge 90$ bersama Tuanku Imam Bonjol.
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
   - **Tier 3**: Panel Review 4-Jalur (`/ompimpa:review`) dan Full Verification Suite (`/ompimpa:verify`).
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
│ 5. Review & Verifikasi  ───>  /ompimpa:review  (Panel 6-Jalur)    │
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
framework = "phoenix"

[locale]
communication_language = "id"    # Bahasa agen saat berdiskusi di chat ("id" | "en")
document_output_language = "id"  # Bahasa dokumen resmi PRD, ADR, dan Diátaxis ("id" | "en")

[governance]
enable_party_mode = true         # Aktifkan musyawarah meja bundar saat ideasi (/ompimpa:ideate)
enable_prd_adr = true            # Aktifkan penyusunan Master PRD dan MADR ADR
artifacts_dir = "_ompimpa"       # Direktori penyimpanan artefak internal PRD, ADR, dan status

[quality]
enable_atdd = true               # Wajibkan tes merah Red-Phase sebelum koding
quality_score_floor = 90         # Batas skor review minimal kelulusan (0-100)
warnings_as_errors = true        # mix compile --warnings-as-errors
max_dev_retries = 3              # Circuit breaker: eskalasi ke manusia jika 3x gagal tes beruntun
auto_macro_review_in_dev = true  # Jalankan full Macro-Review (4-Jalur) di setiap akhir eksekusi story
auto_triage_and_fix = true       # Otomatis triage temuan P0/P1 dan perbaiki sebelum commit final

[quality.nfr]
target_p95_latency_ms = 50       # Target latensi respons p95 (ms) pada naskah PRD

[quality.verify]
steps = [
  "compile --warnings-as-errors",
  "format --check-formatted",
  "test"
]

[resources]
max_concurrency = 2              # Batas subagent paralel aktif (mencegah lonjakan RAM/CPU)
use_git_worktrees = true         # Eksekusi task paralel di Git Worktree terisolasi (~/.omp/wt/)
shared_lsp_server = true         # Gunakan 1 instance LSP bersama untuk seluruh subagent

[models]
ideate = "slow"                  # Rohana Kudus & Tan Malaka (Deep TRIZ & First Principles)
prd = "plan"                     # H. Agus Salim (Master PRD & Architecture Planning)
adr = "plan"                     # H. Agus Salim (Architecture Decision Records)
ui = "design"                   # Marah Rusli (HEEx, Tailwind & Google Stitch Design)
test = "default"                 # Tuanku Imam Bonjol (Red-Phase ATDD Scaffolding)
dev = "default"                  # Backend Specialists (Ash, LiveView, Ecto, Oban, OTP)
commit = "smol"                 # Generator Semantic Commit Message (feat/fix/test/refactor)
ironlaw = "smol"                 # Hj. Rasuna Said (Fast & deterministic Iron Law verification)
security = "slow"                # Bagindo Azizchan (Deep perimeter security & vulnerability audit)
debug = "slow"                   # Adinegoro (4-track deep root cause investigation)
doc = "default"                  # Mohammad Yamin (Diátaxis User, Admin, Dev Guides)

[stacks]
use_ash_framework = true         # Set false jika menggunakan Vanilla Ecto
use_oban = true                  # Set false jika tidak menggunakan Oban
use_tailwind = true

[stacks.liveview]
stream_threshold_rows = 100      # Batas jumlah baris data sebelum wajib menggunakan LiveView Streams

[documentation]
diataxis_format = true           # Terapkan standar 4 kuadran Diátaxis di folder docs/
output_dir = "docs"              # Target folder untuk dokumentasi Diátaxis resmi proyek

[tools]
enable_tidewave = true           # Aktifkan Tidewave MCP untuk inspeksi runtime BEAM live
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

### 3. Slash Commands di Sesi OMP
* `/ompimpa:balairung [topik]` — Sidang musyawarah 3-ronde (Blind, Debat, Verdict) bersama dewan tokoh.
* `/ompimpa:ideate [ide]` — Memulai musyawarah ideasi & resolusi TRIZ.
* `/ompimpa:adr [keputusan]` — Mencatat keputusan arsitektur MADR 3.0+ di `_ompimpa/adr/`.
* `/ompimpa:ui [komponen]` — Merancang HEEx, Tailwind, Google Stitch UI prompt, dan preview Chromium.
* `/ompimpa:atdd [story]` — (Opsional) Merancang matriks risiko dan scaffold tes merah secara mandiri.
* `/ompimpa:dev [--auto]` — Menjalankan loop dev otonom terintegrasi (Auto ATDD Merah ➔ Koding Hijau ➔ Review ➔ Commit).
* `/ompimpa:course-correct` — Menyelaraskan kembali PRD & rencana saat terjadi pivot.
* `/ompimpa:review` — Menjalankan panel review paralel 6-subagent.
* `/ompimpa:verify` — Memeriksa kompilator strict dan seluruh tes ExUnit.
* `/ompimpa:doc <user|admin|dev>` — Menghasilkan panduan Diátaxis di `docs/`.
* `/ompimpa:audit` — Audit kesehatan arsitektur, N+1, assigns, dan Hex security.
* `/ompimpa:techdebt` — Memindai Credo strict dan hutang teknis.
* `/ompimpa:compound [topik]` — Menyimpan pola solusi teruji di `_ompimpa/solutions/`.

---

## 6. License
MIT License.
