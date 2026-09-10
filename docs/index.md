# Dokumentasi OMP-IMPA (`ompimpa`)

Selamat datang di dokumentasi resmi **OMP-IMPA** (*Integrated Modular Phoenix Architecture for Oh My Pi*). 

Dokumentasi ini disusun menggunakan **Standar 4 Kuadran Diátaxis** untuk memisahkan secara tegas antara materi pembelajaran, panduan tugas praktis, referensi teknis, dan penjelasan arsitektur.

---

```
                              ┌─────────────────────────────────────────────────────────────┐
                              │                 PETA DOKUMENTASI DIÁTAXIS                   │
                              └─────────────────────────────────────────────────────────────┘
                                           PRACTICAL (Aksi / Kerja)     THEORETICAL (Pengetahuan / Nalar)
                              ┌─────────────────────────────────────────┬───────────────────────────────────┐
             LEARNING-ORIENTED│  1. TUTORIALS                           │  4. EXPLANATION                   │
          (Tahap Pembelajaran)│     Langkah awal belajar dari nol       │     Pemahaman mendalam & konsep   │
                              ├─────────────────────────────────────────┼───────────────────────────────────┤
                 TASK-ORIENTED│  2. HOW-TO GUIDES                       │  3. REFERENCE                     │
        (Penyelesaian Masalah)│     Panduan menyelesaikan tugas nyata   │     Spesifikasi teknis & parameter│
                              └─────────────────────────────────────────┴───────────────────────────────────┘
```

---

## 🧭 1. Tutorials (Tahap Pembelajaran)
*Berorientasi pada proses belajar pemula secara berurutan langkah demi langkah:*
* **[Tutorial: Memulai dengan OMP-IMPA dalam 15 Menit](tutorials/getting-started.md)** — Panduan instalasi, linking plugin, inisialisasi proyek Phoenix, dan eksekusi siklus fitur pertama.
* **[Tutorial 01: Getting Started Deterministik](tutorials/01-getting-started.md)** — Panduan eksekusi epic loop (A-01 s/d E-03) berbasis DAG dan verifikasi bertingkat T1/T2/T3.

---

## 🛠️ 2. How-To Guides (Panduan Tugas Nyata)
*Berorientasi pada penyelesaian masalah atau alur kerja praktis tertentu:*
* **[How-To: Deliberasi Sidang Balairung](how-to/deliberate-in-balairung.md)** — Cara membuka sidang musyawarah multi-persona 3-ronde dan menyusun tabel inventaris (INV-10).
* **[How-To: Ideasi Musyawarah & Master PRD](how-to/ideate-and-draft-prd.md)** — Cara menjalankan musyawarah ideasi SCAMPER/TRIZ, menyusun PRD, dan verifikasi inventaris.
* **[How-To: Scaffolding Tes Merah (ATDD)](how-to/scaffold-atdd-tests.md)** — Cara merancang matriks risiko P1-P4, pemetaan TEA-01, dan anti-flaky in-band.
* **[How-To: Loop Koding Otonom & Outer CLI Driver](how-to/run-autonomous-dev-loop.md)** — Cara menjalankan `/ompimpa:dev` berbasis disk DAG state dan `bin/ompimpa dev --epic` di shell OS.
* **[How-To: Memantau Dev Loop dengan Terminal UI Monitor](how-to/monitor-with-tui.md)** — Cara memantau kanban stories, spec mikro JIT, dan live tool activity stream via `ompimpa tui`.
* **[How-To: Menggunakan LiveView Streams untuk Daftar >100 Baris](how-to/how-to-use-liveview-streams.md)** — Menerapkan `stream/3` sesuai Hukum Besi #3 untuk mencegah memory bloat.
* **[How-To: Review Terisolasi 10-Subagent & Verifikasi Mutu](how-to/review-and-verify-code.md)** — Cara mengeksekusi panel review 10 subagent (4 BMAD + 6 Tech), scoring 100/100, dan tiered verify.
* **[How-To: Master Diagnostik 4-Pilar Proyek](how-to/inspect-project-health.md)** — Cara menjalankan `/ompimpa:inspect` out-of-band dan auto-triage hutang teknis ke `EPIC-DEBT`.
* **[How-To: Analisis Blast-Radius & Graphify](how-to/analyze-blast-radius-graphify.md)** — Cara memetakan graf dependensi modul via `mix xref` + LSP dan menghitung blast-radius refactoring.
* **[How-To: Menyusun Panduan Diátaxis](how-to/generate-diataxis-docs.md)** — Cara menghasilkan User, Admin, dan Dev Guides dengan subagent Mohammad Yamin.

---

## 📖 3. Reference (Informasi & Spesifikasi Teknis)
*Berorientasi pada informasi teknis murni, parameter, dan daftar referensi:*
* **[Referensi: Daftar Perintah Cepat (*Slash Commands*) & CLI](reference/slash-commands.md)** — Spesifikasi 19 slash commands (`commands/*.md`) + 19 perintah CLI `bin/ompimpa` (`src/cli.ts`), flag, dan subagent terkait.
* **[Referensi: Roster 14 Subagent Nusantara](reference/subagents-roster.md)** — Daftar 14 agen spesialis dan inspirasi tokoh Minangkabau.
* **[Referensi: Spesifikasi Konfigurasi `ompimpa.toml`](reference/configuration-toml.md)** — Kamus lengkap seluruh opsi konfigurasi proyek.
* **[Referensi: 26 Hukum Besi Elixir & Phoenix](reference/26-iron-laws.md)** — Daftar lengkap 26 invariant non-negotiable BEAM.
---

## 💡 4. Explanation (Penjelasan & Nalar Arsitektur)
*Berorientasi pada pemahaman konsep, latar belakang, dan alasan desain:*
* **[Penjelasan: Struktur Berkas, Penempatan Plugin, & Pelacakan Git](explanation/repository-structure-and-git-tracking.md)** — Penjelasan lokasi file plugin, penempatan artefak di proyek target, dan mengapa seluruh dokumen `docs/` wajib masuk Git.
* **[Penjelasan: Arsitektur Tripartit OMP-IMPA](explanation/tripartite-architecture.md)** — Mengapa penggabungan BMAD + phxagents + OMP Engine sangat berdaya guna.
* **[Penjelasan: Arsitektur Gerbang Mutu Bertingkat (*Multi-Tier Quality Gates*)](explanation/two-tier-quality-gates.md)** — Penjelasan perlindungan mutu 4 lapis (Tier 0 TTSR, Tier 1 Hook, Tier 2 Git Hook, Tier 3 10-Review & Tiered Verify).
* **[Penjelasan: State Persisten di Disk & Circuit Breakers](explanation/state-persistence-and-circuit-breakers.md)** — Mengapa state dicatat di YAML disk dan bagaimana mencegah token loop.
