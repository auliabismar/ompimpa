# OMP-IMPA (`ompimpa`)

> **Integrated Modular Phoenix Architecture for Oh My Pi (`omp`)**
> *Menyatukan Daya Pikir Produk BMAD (BMM + CIS + TEA), Keahlian Domain Elixir/Phoenix (phxagents), dan Mesin Eksekusi Paralel Native OMP.*

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
3. **OMP Native Execution Engine**:
   - Konkurensi DAG subagent hingga 32 subagent paralel (`task`).
   - Isolasi Git Worktree untuk pengerjaan slice independen.
   - Language Server Protocol (`xd://lsp`) dan AST rewrites (`xd://ast_edit`).
   - Bukti verifikasi visual via Headless Chromium (`xd://browser`).

---

## 2. Siklus Hidup 6-Tahap Terpadu (Unified Lifecycle)

```
[1. FASE PRODUK & IDEASI]   ───>  /ompimpa:ideate  (Musyawarah SCAMPER, Empathy & TRIZ)
                            ───>  /ompimpa:prd     (Master PRD & Epics Spine)
                            ───>  /ompimpa:adr     (MADR Architecture Decision Records)

[2. FASE DESAIN & UI]       ───>  /ompimpa:ui      (HEEx, Tailwind CSS & CoreComponents)

[3. FASE DESAIN PENGUJIAN]  ───>  /ompimpa:atdd    (Risk Matrix P1-P4 & Red-Phase Tests)

[4. FASE EKSEKUSI OTONOM]   ───>  /ompimpa:dev     (Story Loop + Micro-Review + State YAML)
                            ───>  /ompimpa:course-correct (Pivot & Penyelarasan Rencana)

[5. FASE REVIEW & PROOF]    ───>  /ompimpa:review  (Panel Review Paralel 4-Jalur)
                            ───>  /ompimpa:verify  (Strict Compiler, Credo, Tests Loop)

[6. FASE DOKUMENTASI & DOC] ───>  /ompimpa:doc     (Diátaxis User / Admin / Dev Guides)
```

---

## 3. Daftar 14 Core Subagents (`agents/`)

| Nama Subagent | Inspirasi Tokoh Minangkabau | Keahlian & Tanggung Jawab |
| :--- | :--- | :--- |
| `ompimpa-ideate.md` | **Rohana Kudus** | Curah pendapat SCAMPER, pemetaan empati, dan How Might We (HMW). |
| `ompimpa-triz.md` | **Tan Malaka** | Resolusi kontradiksi teknis, logika First Principles, dan *Madilog*. |
| `ompimpa-prd.md` | **H. Agus Salim** | Master PRD, Epics & Stories Spine, serta naskah ADR berstandar MADR. |
| `ompimpa-ui.md` | **Marah Rusli** | Komponen HEEx, styling Tailwind CSS responsif, dan CoreComponents. |
| `ompimpa-test.md` | **Tuanku Imam Bonjol** | Matriks risiko P1-P4, Red-Phase ATDD, dan Scorecard Mutu $\ge 90$. |
| `ompimpa-ash.md` | **Syekh Ahmad Khatib** | Resources Ash deklaratif, Actions, Kebijakan *Fail-Closed*, dan Query. |
| `ompimpa-liveview.md`| **Tuanku Tambusai** | Lifecycle socket, optimasi memori Streams, JS Hooks, dan PubSub. |
| `ompimpa-ecto.md` | **Bung Hatta** | Skema database, changeset, constraint, migrasi aman, dan `Ecto.Multi`. |
| `ompimpa-oban.md` | **Djamaluddin Tamin** | Background worker idempotent, antrean unik, dan penjadwalan cron. |
| `ompimpa-otp.md` | **Sutan Sjahrir** | Tata kelola BEAM, Supervision Tree, dan isolasi proses. |
| `ompimpa-ironlaw.md` | **Hj. Rasuna Said** | Hakim penegak 26 Hukum Besi Elixir pada setiap diff kode. |
| `ompimpa-security.md`| **Bagindo Azizchan** | Benteng keamanan perimeter (CSRF, XSS, Atom DoS, Safe Params, Hex). |
| `ompimpa-debug.md` | **Adinegoro** | Investigasi bug mendalam, analisis akar masalah (RCA), dan call tracer. |
| `ompimpa-doc.md` | **Mohammad Yamin** | Dokumentasi terstruktur 4 kuadran Diátaxis (User, Admin, Dev Guides). |

---

## 4. Konfigurasi Modularitas (`ompimpa.toml`)

```toml
# ompimpa.toml (Konfigurasi Target Proyek)
[project]
name = "mimar"
framework = "phoenix"

[locale]
communication_language = "id"    # Bahasa agen saat berdiskusi di chat ("id" | "en")
document_output_language = "id"  # Bahasa dokumen resmi PRD, ADR, dan Diátaxis ("id" | "en")

[governance]
enable_party_mode = true         # Aktifkan musyawarah meja bundar saat ideasi (/ompimpa:ideate)
enable_prd_adr = true            # Aktifkan penyusunan Master PRD dan MADR ADR

[quality]
enable_atdd = true               # Wajibkan tes merah Red-Phase sebelum koding
quality_score_floor = 90         # Batas skor review minimal kelulusan (0-100)
warnings_as_errors = true        # mix compile --warnings-as-errors
max_dev_retries = 3              # Circuit breaker: eskalasi ke manusia jika 3x gagal tes beruntun

[stacks]
use_ash_framework = true         # Set false jika menggunakan Vanilla Ecto
use_oban = true                  # Set false jika tidak menggunakan Oban
use_tailwind = true

[documentation]
diataxis_format = true           # Terapkan standar 4 kuadran Diátaxis (User, Admin, Dev)

[tools]
enable_tidewave = true           # Aktifkan Tidewave MCP untuk inspeksi runtime BEAM live
enable_compound_memory = true    # Simpan dan indeks solusi teruji di docs/solutions/

[runtime_verification]
browser_e2e = true               # Buka Chromium untuk verifikasi visual jalur kritis
in_process_liveview = true       # Jalankan Phoenix.LiveViewTest in-process (~5ms)
```

---

## 5. Quick Start & Perintah Utama

### Inisialisasi di Proyek Phoenix
```bash
cd /path/to/phoenix_app
ompimpa init
ompimpa doctor
```

### Slash Commands di Sesi OMP
* `/ompimpa:ideate [ide]` — Memulai musyawarah ideasi & resolusi TRIZ.
* `/ompimpa:prd [judul]` — Menyusun Master PRD & Epics Spine.
* `/ompimpa:adr [keputusan]` — Mencatat keputusan arsitektur MADR 3.0+.
* `/ompimpa:ui [komponen]` — Merancang HEEx, Tailwind, dan preview Chromium.
* `/ompimpa:atdd [story]` — Membuat matriks risiko dan scaffold tes merah.
* `/ompimpa:dev [--auto]` — Menjalankan loop koding otonom sampai tes hijau.
* `/ompimpa:course-correct` — Menyelaraskan kembali PRD & rencana saat terjadi pivot.
* `/ompimpa:review` — Menjalankan panel review paralel 4-jalur.
* `/ompimpa:verify` — Memeriksa kompilator strict dan seluruh tes ExUnit.
* `/ompimpa:doc <user|admin|dev>` — Menghasilkan panduan Diátaxis.
* `/ompimpa:audit` — Audit kesehatan arsitektur, N+1, assigns, dan Hex security.
* `/ompimpa:techdebt` — Memindai Credo strict dan hutang teknis.
* `/ompimpa:compound [topik]` — Menyimpan pola solusi teruji ke memori proyek.

---

## 6. License
MIT License.
