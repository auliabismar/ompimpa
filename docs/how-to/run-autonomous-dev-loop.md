# How-To: Menjalankan Loop Eksekusi Koding Otonom (`/ompimpa:dev`)

Panduan ini menjelaskan cara menjalankan siklus implementasi otonom berbasis state di disk (`_ompimpa/status/feature-status.yaml`), prinsip pengujian terfokus (*Scoped Testing*), peran OMP Guard Hook dalam menjaga kelanjutan loop, dan penanganan *circuit breaker*.

---

## 1. Menjalankan Dev Loop Tunggal

Untuk mengerjakan satu story berikutnya yang siap dikerjakan:

```bash
/ompimpa:dev
# Atau spesifik per story / per epic:
/ompimpa:dev --story A-01
/ompimpa:dev --epic EPIC-A
```

### Siklus Tertutup yang Berjalan:
1. **Validasi DAG & Baca State di Disk**:
   - Membaca Directed Acyclic Graph (DAG) di `_ompimpa/stories.yaml`.
   - Memeriksa apakah ada story prasyarat yang belum tuntas (`blocked_by`).
   - Mengambil story berikutnya dengan `status: ready-for-dev` dari `_ompimpa/status/feature-status.yaml`.
2. **JIT Micro-Spec & Auto-ATDD Red-Phase Scaffolding**:
   - Membuat spesifikasi mikro Just-In-Time di `_ompimpa/specs/SPEC-[ID].md` memuat kriteria Gherkin dan blast-radius berkas.
   - Subagent `ompimpa-test` (Tuanku Imam Bonjol) men-generate tes penerimaan merah (Red-Phase) yang memetakan 100% skenario Gherkin (TEA-01 Traceability).
   - Memvalidasi tes berstatus **FAIL (Red-Phase)** secara sah via *Scoped Test* (`mix test <path_test.exs>`).
3. **Koding Spesialis**:
   - Spesialis stack (`ompimpa-ash`, `ompimpa-liveview`, `ompimpa-ecto`, `ompimpa-oban`, `ompimpa-otp`) mengedit kode di Git Worktree terisolasi hingga seluruh asersi tes berstatus **HIJAU (PASS)**.
   - Penegakan real-time Tier 0 TTSR menghentikan seketika kesalahan sintaksis fatal (uang float, socket unauth).
4. **Dual-Review 10 Subagent Terisolasi & Triage (100/100 PASS)**:
   - Melakukan dispatch paralel **10 subagent isolated review** (`task(isolated: true)`):
     - **4 Lensa Spesifikasi BMAD**: `bmad_adversarial`, `bmad_gap_verifier`, `bmad_structural`, `bmad_completeness`.
     - **6 Spesialis phxagents**: `ompimpa-ironlaw`, `ompimpa-security`, `ompimpa-test`, `ompimpa-verify`, `ompimpa-ecto`/`ash`, `ompimpa-liveview`/`oban`.
   - Menyimpan seluruh temuan review ke `_ompimpa/review/[ID]-[agent].json`.
   - Menjalankan **Triage Engine**: deduplikasi temuan dengan hash `file:line:ruleId`, penilaian terhadap 35-Row Criteria Registry, dan penerbitan *Remediation Plan* P0→P1→P2.
   - Wajib mencapai skor **100/100 PASS**. Jika ditemukan P0/P1, memicu remediasi terfokus (maksimal `max_triage_fix_cycles = 3`).
5. **Semantic Git Commit & Status Sync (`smol` model)**:
   - Agen Commit bertenaga model **`smol`** menganalisis staged diff dan menghasilkan **Semantic Commit Message** standar (`feat`, `fix`, `test`, `refactor`).
   - Eksekusi commit diverifikasi secara instan oleh **Fast Pre-Commit Gate** (< 2 detik).
   - Mengubah status story di `_ompimpa/status/feature-status.yaml` menjadi `status: done`.

## 2. Menjalankan Mode Otomatis Penuh (`--auto`)

Untuk menyelesaikan seluruh slice dalam satu inisiatif tanpa intervensi manual:

```bash
/ompimpa:dev --auto
```

### Mekanisme Otonom OMP Hook (`session_stop`):
* Saat satu story selesai dan sesi hendak berhenti, hook OMP `session_stop` otomatis membaca `_ompimpa/status/feature-status.yaml`.
* Jika masih ditemukan story dalam salah satu dari **5 status actionable kanonis** (`backlog`, `ready-for-atdd`, `ready-for-dev`, `in-progress`, `in-review`), hook menginstruksikan agent untuk melanjutkan (`continue: true`) ke story berikutnya secara rekursif hingga seluruh roadmap tuntas.

---

## 3. Outer Loop Driver di Terminal OS (`bin/ompimpa dev --epic`)

Untuk menjalankan eksekusi beruntun multi-story tanpa risiko kelelahan konteks (*context rot* / token exhaustion) di sesi LLM tunggal, gunakan **Outer CLI Loop Runner**:

```bash
bin/ompimpa dev --epic EPIC-A --auto
# Atau jalankan tanpa sesi headless harness terpisah (hanya gerbang lokal):
bin/ompimpa dev --epic EPIC-A --auto --no-harness
```
### Bagaimana Outer Loop Bekerja?
1. Outer loop runner (`src/loop_runner.ts`) dieksekusi di level terminal OS shell (Node.js/Bun).
2. Runner membaca urutan topologis DAG `_ompimpa/stories.yaml` untuk epic yang ditentukan.
3. Untuk setiap story:
   - Membuka sub-proses OMP harness bersih (*fresh context window*).
   - Menjalankan tahapan koding, pengujian, 10-isolated review, dan triage.
   - Mengikat commit semantik saat skor 100/100 tercapai dan mengupdate state di disk.
   - Menutup sub-proses dan membersihkan memori sebelum melangkah ke story berikutnya.

---

## 4. Eksekusi Fase Modular Mandiri (Step-by-Step)

Jika Anda ingin melakukan inspeksi atau intervensi manual pada fase tertentu tanpa menjalankan loop penuh:

```bash
# 0. Periksa status dan kelengkapan story saat ini
bin/ompimpa status A-01

# 1. Buat spesifikasi mikro JIT
/ompimpa:story A-01

# 2. Generate tes penerimaan merah ATDD
/ompimpa:atdd A-01

# 3. Implementasi koding hijau
/ompimpa:code A-01

# 4. Jalankan 10 isolated reviewers
/ompimpa:review A-01

# 5. Triage temuan & cek kelulusan 100/100
/ompimpa:triage A-01

# 6. Konfirmasi status kanonis story telah done
bin/ompimpa status A-01
```

## 5. Penanganan Kebuntuan (*Circuit Breaker*)

Jika sebuah slice gagal tes atau gagal review sebanyak **3 kali berturut-turut** (diatur via `max_dev_retries = 3` di `ompimpa.toml`):
1. **Loop Otomatis Berhenti**: Sistem memutus loop (*circuit breaker trip*) untuk mencegah pemborosan token dan loop tak berujung.
2. **Eskalasi ke Manusia**: Agen menampilkan ringkasan kendala teknis dan meminta keputusan Anda via dialog interaktif `ask`.
3. Setelah Anda memberikan arahan atau melakukan perbaikan manual, jalankan kembali `/ompimpa:dev` untuk melanjutkan.
