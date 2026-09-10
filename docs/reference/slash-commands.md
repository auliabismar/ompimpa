# Referensi: Daftar Perintah Cepat (*Slash Commands*)

Dokumen referensi (*Information-Oriented*) ini memuat daftar lengkap perintah slash command yang tersedia di OMP-IMPA beserta sintaks, opsi, dan agen penanggung jawabnya.

---

## Tabel Ringkasan Perintah

| Perintah | Deskripsi | Subagent Penanggung Jawab | Contoh Penggunaan |
| :--- | :--- | :--- | :--- |
| **`/ompimpa:balairung`** | Sidang musyawarah interaktif (Party Mode) bersama dewan tokoh | Dewan Tokoh OMP-IMPA | `/ompimpa:balairung [topik]` / `--close` |
| **`/ompimpa:ideate`** | Musyawarah ideasi & resolusi kontradiksi TRIZ | `ompimpa-ideate` & `ompimpa-triz` | `/ompimpa:ideate [ide]` |
| **`/ompimpa:prd`** | Menyusun Master PRD & Epics Spine | `ompimpa-prd` | `/ompimpa:prd [judul]` |
| **`/ompimpa:adr`** | Mencatat keputusan arsitektur MADR 3.0+ | `ompimpa-prd` | `/ompimpa:adr [judul]` |
| **`/ompimpa:ui`** | Merancang HEEx, Tailwind, & Google Stitch UI prompt | `ompimpa-ui` | `/ompimpa:ui [nama-komponen]` |
| **`/ompimpa:story`** | Scaffolding spesifikasi mikro JIT (`_ompimpa/specs/SPEC-[ID].md`) | `ompimpa-prd` | `/ompimpa:story <ID>` |
| **`/ompimpa:atdd`** | Scaffolding tes penerimaan merah (Red-Phase ATDD) & pemetaan TEA-01 | `ompimpa-test` | `/ompimpa:atdd <ID>` |
| **`/ompimpa:code`** | Implementasi koding hijau terisolasi per story | Spesialis Backend | `/ompimpa:code <ID>` |
| **`/ompimpa:review`** | Panel review 10 subagent terisolasi sejati (4 BMAD + 6 Tech) | Panel 10 Subagent | `/ompimpa:review <ID>` / `[--staged]` |
| **`/ompimpa:triage`** | Deduplikasi temuan `file:line:ruleId`, scoring 100/100, & remediation plan | `ompimpa-test` & `ompimpa-review` | `/ompimpa:triage <ID>` |
| **`/ompimpa:dev`** | Loop dev otonom terintegrasi (JIT Spec ➔ ATDD ➔ Code ➔ 10-Review ➔ Triage ➔ Commit) | Backend Specialist | `/ompimpa:dev [--epic <ID>] [--story <ID>] [--auto]` |
| **`/ompimpa:course-correct`** | Kalibrasi ulang PRD & rencana saat pivot | `ompimpa-prd` & `ompimpa-triz` | `/ompimpa:course-correct [kendala]` |
| **`/ompimpa:graphify`** | Analisis visual dependensi modul & blast-radius via `mix xref` + LSP | `ompimpa-ecto` | `/ompimpa:graphify` |
| **`/ompimpa:verify`** | Tiered verification (T1 <2s, T2 <10s, T3 bg) & strict compiler suite | `ompimpa-verify` | `/ompimpa:verify` |
| **`/ompimpa:doc`** | Menyusun panduan Diátaxis User/Admin/Dev | `ompimpa-doc` | `/ompimpa:doc <user\|admin\|dev>` |
| **`/ompimpa:inspect`** | Master diagnostic out-of-band terpadu (Batas, Performa, Keamanan, Docs) & auto-triage EPIC-DEBT (unifikasi audit, boundaries, perf, techdebt) | `ompimpa-test` & `ompimpa-prd` | `/ompimpa:inspect [--boundaries\|--perf\|--security\|--docs\|--dry-run]` |
| **`/ompimpa:prewalk`** | Scan AST/regex 26 Iron Laws + TTSR stream rules + validasi DAG | CLI Engine + `ompimpa-ironlaw` | `/ompimpa:prewalk [paths]` / `ompimpa prewalk` |
| **`/ompimpa:compound`** | Menyimpan pola solusi ke memori proyek | `ompimpa-compound` | `/ompimpa:compound [topik]` |
| **`/ompimpa:doctor`** | Diagnosa toolchain & konfigurasi repo | CLI Engine | `/ompimpa:doctor` |

---

| Perintah CLI | Deskripsi | Rujukan Story / Epic |
| :--- | :--- | :--- |
| **`bin/ompimpa init [--force] [--ash\|--no-ash] [--oban\|--no-oban]`** | Scaffold Greenfield (`scope=full`) / Brownfield (`scope=delta`), auto-detect `:ash`/`:oban` dari `mix.exs` | Story C-04 |
| **`bin/ompimpa doctor`** | Diagnosa mix.exs, ompimpa.toml, feature-status, AGENTS.md, hooks, agents sync, Diátaxis, rules, manifests, toolchain | Setup & Tooling |
| **`bin/ompimpa verify [--tier1\|--tier2\|--tier3\|--all]`** | Default T1+T2 blocking (<12s), T3 background (`test`, `credo --strict`, `sobelow --strict --format json`) | Story B-04 |
| **`bin/ompimpa dev [--epic <ID>] [--story <ID>] [--auto] [--no-harness]`** | Validasi DAG + 5 fase per story (story→atdd→code→review→triage). Flag `--no-harness` menonaktifkan sesi headless omp. | Story A-02, D-04 |
| **`bin/ompimpa story <ID> [--dry-run] [--force]`** | Generate `_ompimpa/specs/SPEC-[ID].md` → `ready-for-atdd` | Story D-01 |
| **`bin/ompimpa atdd <ID>`** | Gate SPEC + cek berkas tes ada → `ready-for-dev` | Story E-01 |
| **`bin/ompimpa code <ID> [--circuit-breaker=N]`** | Gate SPEC (INV-09), info scoped-test, next `/review` | D-02 |
| **`bin/ompimpa review <ID> [--story=ID]`** | Panel multi-spesialis 10 subagent terisolasi + scorecard TEA | Story B-01/B-03 |
| **`bin/ompimpa triage <ID> [--strict] [--json] [--adjudicate] [--no-adjudicate]`** | Dedup `file:line:ruleId`, scoring 100/100, & adjudikasi sengketa Tier 2.5 | Story D-02/B-02 |
| **`bin/ompimpa status [<ID>]`** | Inspeksi kanonis story lifecycle (backlog → done), verifikasi SPEC, berkas uji, bukti review, triage verdict, dan git history | Story E-01 / Status Canon |
| **`bin/ompimpa tui [--show-thinking] [--fps <n>]`** | Dashboard terminal interaktif (EPIC-F) pemantau kanban stories, spec JIT, dan live stream kegiatan subagent | EPIC-F (F-01..F-05) |
| **`bin/ompimpa inventory --balairung <file> [--prd <file>] [--stories <file>]`** | Gerbang tabel Inventaris + cakupan PRD anti scope-truncation (INV-10) | Balairung→PRD |
| **`bin/ompimpa prewalk [paths]`** | Scan Elixir vs 26 Iron Laws + cek DAG sirkular | Story A-01 |
| **`bin/ompimpa inspect [--boundaries\|--perf\|--security\|--docs\|--dry-run]`** | Master diagnostic out-of-band 4-pilar & auto-triage backlog ke `EPIC-DEBT` | Story C-06, E-03 |
| **`bin/ompimpa graphify [--blast <file>]`** | Ekstraksi graf `_ompimpa/graph.json` + `graph.html` | Story C-01 |
| **`bin/ompimpa sweep [--dry-run]`** | Promote deferred P2 open → ready-for-dev | Story C-02 |
| **`bin/ompimpa doc`** | Generator deterministik 4 kuadran Diátaxis (`tutorials/how-to/reference/explanation`) | Story C-05 |
| **`bin/ompimpa sync`** | Sinkron `ompimpa.toml` model tiers → frontmatter `agents/` | Tooling |
| **`bin/ompimpa link`** | `omp plugin link` + shim `~/.local/bin/ompimpa` | Setup |
