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

---

## 🛠️ 2. How-To Guides (Panduan Tugas Nyata)
*Berorientasi pada penyelesaian masalah atau alur kerja praktis tertentu:*
* **[How-To: Ideasi Musyawarah & Master PRD](how-to/ideate-and-draft-prd.md)** — Cara menjalankan musyawarah ideasi SCAMPER/TRIZ dan menyusun PRD.
* **[How-To: Scaffolding Tes Merah (ATDD)](how-to/scaffold-atdd-tests.md)** — Cara merancang matriks risiko P1-P4 dan membuat tes penerimaan merah.
* **[How-To: Loop Koding Otonom & Circuit Breaker](how-to/run-autonomous-dev-loop.md)** — Cara menjalankan `/ompimpa:dev` berbasis disk state.
* **[How-To: Review Paralel & Verifikasi Mutu](how-to/review-and-verify-code.md)** — Cara mengeksekusi panel review 4-jalur dan compiler gate.
* **[How-To: Menyusun Panduan Diátaxis](how-to/generate-diataxis-docs.md)** — Cara menghasilkan User, Admin, dan Dev Guides dengan subagent Mohammad Yamin.

---

## 📖 3. Reference (Informasi & Spesifikasi Teknis)
*Berorientasi pada informasi teknis murni, parameter, dan daftar referensi:*
* **[Referensi: Daftar Perintah Cepat (*Slash Commands*)](reference/slash-commands.md)** — Spesifikasi 13 slash commands, flag, dan subagent terkait.
* **[Referensi: Roster 14 Subagent Nusantara](reference/subagents-roster.md)** — Daftar 14 agen spesialis dan inspirasi tokoh Minangkabau.
* **[Referensi: Spesifikasi Konfigurasi `ompimpa.toml`](reference/configuration-toml.md)** — Kamus lengkap seluruh opsi konfigurasi proyek.
* **[Referensi: 26 Hukum Besi Elixir & Phoenix](reference/26-iron-laws.md)** — Daftar lengkap 26 invariant non-negotiable BEAM.

---

## 💡 4. Explanation (Penjelasan & Nalar Arsitektur)
*Berorientasi pada pemahaman konsep, latar belakang, dan alasan desain:*
* **[Penjelasan: Struktur Berkas, Penempatan Plugin, & Pelacakan Git](explanation/repository-structure-and-git-tracking.md)** — Penjelasan lokasi file plugin, penempatan artefak di proyek target, dan mengapa seluruh dokumen `docs/` wajib masuk Git.
* **[Penjelasan: Arsitektur Tripartit OMP-IMPA](explanation/tripartite-architecture.md)** — Mengapa penggabungan BMAD + phxagents + OMP Engine sangat berdaya guna.
* **[Penjelasan: Arsitektur Review Dua Tingkat (*Two-Tier Review*)](explanation/two-tier-quality-gates.md)** — Alasan pemisahan Micro-Review per-story dan Macro-Review per-fitur.
* **[Penjelasan: State Persisten di Disk & Circuit Breakers](explanation/state-persistence-and-circuit-breakers.md)** — Mengapa state dicatat di YAML disk dan bagaimana mencegah token loop.
