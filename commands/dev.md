---
description: Pipeline Coordinator yang merangkai 5 fase rekayasa modular atomik (/story -> /atdd -> /code -> /review -> /triage) secara terpadu
---

# Command: /ompimpa:dev (Pipeline Coordinator)

Mengoordinasikan siklus rekayasa perangkat lunak modular tertutup (*Closed-Loop Modular Pipeline*) berbasis *disk state* (`_ompimpa/status/feature-status.yaml`). Perintah ini bertindak sebagai konduktor orkestrasi yang merangkai **5 fase atomik independen**:

$$\text{Pipeline} = \text{/story} \longrightarrow \text{/atdd} \longrightarrow \text{/code} \longrightarrow \text{/review} \longrightarrow \text{/triage}$$

> 🛡️ **Invarian INV-08 (Pipeline Modularity — ADR-002):**  
> Setiap fase dalam rantai rekayasa (`/story`, `/atdd`, `/code`, `/review`, `/triage`) WAJIB dapat dijalankan secara mandiri (*standalone*) oleh pengembang tanpa dipaksa menjalankan seluruh siklus `/dev`.
>
> 🛡️ **Invarian INV-01 Reinforced (Anti-Inline Review):**  
> Evaluasi kualitas pada fase review WAJIB di-dispatch melalui subagent terisolasi (`task`) ke 10 reviewer independen. Dilarang melakukan review inline di thread utama demi mencegah bias konfirmasi.

---

## Dua Moda Orkestrasi (Dual Execution Jurisdiction)

Sesuai ketetapan **ADR-002 (§4.1)**, terdapat pembagian yurisdiksi eksekusi yang tegas:

| Yurisdiksi | Lingkungan Eksekusi | Peran & Cakupan | Penanganan Context Window |
|---|---|---|---|
| **In-Harness Shortcut** (`/dev <ID>`) | Sesi Chat Interaktif OMP | *Convenience runner* untuk 1 story tunggal secara berurutan. | Menjalankan subagent modular dalam satu sesi aktif. |
| **Outer CLI Driver** (`ompimpa dev --epic`) | Terminal OS Shell | *Outer loop controller* untuk multi-story dalam satu Epic. | Memanggil subprocess OMP bersih (*fresh context*) per-langkah guna mencegah *Context Rot* (>100k token). |

---

### Di Dalam Sesi OMP Harness
```bash
/ompimpa:dev                  # Mengerjakan 1 story berikutnya yang siap di feature-status.yaml
/ompimpa:dev --story D-02     # Menjalankan pipeline lengkap untuk Story D-02
/dev D-02                     # Alias singkat untuk spesifik Story D-02
```

### Di Terminal OS Shell (Outer CLI)
```bash
ompimpa dev --epic EPIC-D --auto   # Outer while-loop sekuensial per story dalam Epic D (fresh context per fase)
ompimpa dev --story D-02           # Eksekusi NYATA 5 fase untuk D-02 (bukan validasi): story → atdd → code → review --story → triage --strict
```

> 🔁 **Loop-until-clean per story (semantik bmad-loop run):** tiap story dieksekusi `runStoryPhases` (fresh subprocess per fase, anti context-rot) dan diulang dari fase awal hingga `triage --strict` PASS 100/100 atau circuit breaker (maks 3 retry) memutus ke `failed` + eskalasi manusia. Status `done` HANYA ditulis setelah triage PASS — tidak ada jalan pintas dari `/code` langsung ke done.
>
> 📊 **Lifecycle status disk (`src/status.ts`, never-regress):** `backlog` (PRD sah) → `ready-for-atdd` (ADR sah / SPEC terbit) → `ready-for-dev` (ATDD merah lengkap) → `in-progress` (/code) → `in-review` (/review dispatch) → `done` (/triage PASS). Fase loop memajukan status otomatis; penulisan mundur (mis. done → in-progress) ditolak.

---

## Arsitektur 5 Fase Rekayasa Modular

Setiap story yang diproses melalui `/dev` melalui 5 gerbang kualitas modular:

```
                  ┌──────────────────────────────────────────────────────────┐
                  │          /ompimpa:dev (Pipeline Coordinator)             │
                  └─────────────────────────────┬────────────────────────────┘
                                                │
       ┌────────────────────────────────────────┴────────────────────────────────────────┐
       ▼                                                                                 ▼
[FASE 1: /story <ID>]              ──► Scaffolding Kontrak Mikro Just-In-Time:
                                       • Persona: `ompimpa-prd` (H. Agus Salim).
                                       • Output: `_ompimpa/specs/SPEC-[ID].md`.
                                       • Memuat: Skenario Gherkin (@tea-01), function signatures,
                                         schema data, lazy mix xref blast-radius.
                                                │
                                                ▼
[FASE 2: /atdd <ID>]               ──► Scaffolding Tes Merah (Red-Phase ATDD):
                                       • Persona: `ompimpa-test` (Tuanku Imam Bonjol).
                                       • Output: Berkas tes di `test/..._test.exs` atau `test/*.test.ts`.
                                       • Target: Asersi sengaja FAILING (memetakan 100% Gherkin AC).
                                                │
                                                ▼
[FASE 3: /code <ID>]               ──► Implementasi Kode Produksi (Green-Phase):
                                       • Persona: Spesialis Stack (`ash`, `ecto`, `liveview`, `oban`, `otp`).
                                       • Eksekusi: Scoped test loop terfokus hingga seluruh asersi PASS.
                                       • Guard: Dilindungi Circuit Breaker (maksimal 3 retry perbaikan).
                                                │
                                                ▼
[FASE 4: /review <ID>]             ──► Dispatch 10 Subagent Review Terisolasi:
                                       • 4 BMAD Spec: `adversarial`, `gap_verifier`, `structural`, `completeness`.
                                       • 6 Tech Panel: `ironlaw`, `security`, `test`, `verify`, `ash/ecto`, `liveview/oban`.
                                       • Output: 10 berkas JSON di `_ompimpa/review/<ID>-<reviewer>.json`.
                                                │
                                                ▼
[FASE 5: /triage <ID>]             ──► Evaluasi Deterministik & Scoring 100/100:
                                       • Mesin: `src/triage.ts` (0 token AI, deterministik).
                                       • Logika: Dedup hash `file:line:ruleId`, penalti v2 (-30/-15/-5/-2).
                                       • Vonis:
                                         ├─► REMEDIATE (Skor < 100):
                                         │   Terbitkan Remediation Plan P0 → P1 → P2.
                                         │   Kembalikan ke Fase 3 (/code) untuk perbaikan terarah
                                         │   (dibatasi max 3 siklus perbaikan).
                                         │
                                         └─► PASS (Skor Mutlak 100/100):
                                             Lolos Quality Gate! Lanjut ke Commit.
                                                │
                                                ▼
[SELESAI: COMMIT & SYNC]           ──► Finalisasi Cerita:
                                       • Agen: `ompimpa-commit` (`smol`) membuat Semantic Commit.
                                       • Update: `_ompimpa/status/feature-status.yaml` ➔ `status: done`.
```

---

## Rincian Tanggung Jawab 5 Fase Atomik

### 1. Fase 1: `/ompimpa:story <ID>` (JIT Spec)
- Mengambil spesifikasi dari PRD makro dan DAG `stories.yaml`.
- Menghasilkan kontrak mikro terisolasi di `_ompimpa/specs/SPEC-[ID].md`.
- Menegakkan **INV-09**: Fase koding dan ATDD tidak boleh dimulai tanpa berkas ini.

### 2. Fase 2: `/atdd <ID>` (Red-Phase Acceptance Testing)
- Mengonversi skenario Gherkin bertag `@tea-01` menjadi asersi kode tes nyata.
- Menilai matriks risiko pengujian (P1–P4) dan memastikan tes gagal (*Red Phase*) secara valid.

### 3. Fase 3: `/code <ID>` (Green-Phase Implementation)
- Menugaskan subagent spesialis stack (`ompimpa-ash`, `ompimpa-ecto`, `ompimpa-liveview`, `ompimpa-oban`, `ompimpa-otp`, `ompimpa-ui`).
- Menulis kode produksi hingga seluruh asersi tes berstatus hijau.
- Menegakkan batas *Circuit Breaker* (maks 3 kali percobaan sebelum eskalasi ke pengembang).

### 4. Fase 4: `/review <ID>` (10 Isolated Reviewers)
- Menjalankan 10 subagent secara paralel melalui batch tool `task(isolated: true)`.
- Mengaudit spesifikasi fungsional (BMAD) dan kepatuhan teknis (26 Hukum Besi, OWASP, TEA Test Scorecard ≥ 90, Strict Compiler).
- Menuliskan 10 laporan terpisah ke dalam `_ompimpa/review/<ID>-<reviewer>.json`.

### 5. Fase 5: `/triage <ID>` (Deterministic Scoring & Gate)
- Melakukan deduplikasi hash `file:line:ruleId` untuk mencegah inflasi penalti.
- Menghitung skor akhir (Skor Maksimal = 100, pemotongan -30/-15/-5/-2).
- Menetapkan vonis mutlak: **PASS (hanya 100/100)** atau **REMEDIATE**.
- Mengelola siklus perbaikan otomatis (*auto triage and fix loop*) maksimal 3 siklus.

---

## Eksekusi Mandiri Fase (Standalone Invariant INV-08)

Pengembang tidak diwajibkan menjalankan seluruh rantai `/dev` jika hanya ingin mengeksekusi fase tertentu. Setiap subperintah dapat dipanggil secara mandiri:

```bash
# Ingin merumuskan spesifikasi JIT saja:
/ompimpa:story D-02

# Ingin merancang tes merah ATDD saja:
/atdd D-02

# Ingin mengimplementasikan kode produksi saja:
/code D-02

# Ingin mengaudit kode dengan 10 subagent saja:
/review D-02

# Ingin melihat scorecard hasil review dan Remediation Plan saja:
/triage D-02
```

---

## Aturan Pengujian Selama Loop (Scoped vs Global Test)

1. **Scoped Test Only:**
   Selama siklus `/code`, pengujian dibatasi hanya pada berkas tes spesifik yang sedang dikerjakan. Dilarang menjalankan full global test suite di tengah loop koding.
2. **Full Suite Verify:**
   Pengujian menyeluruh seluruh proyek dicadangkan untuk perintah `/verify` atau saat satu Epic telah tuntas secara keseluruhan.

---

## Kontrak Headless vs In-Harness (jujur)

- **Tanpa `--auto`** (atau `--no-harness`): CLI hanya menjalankan gerbang lokal
  (SPEC render, scaffold stub, agregasi skor). Kerja kreatif — asersi substantif,
  kode produksi, temuan review — tetap dikerjakan agen di sesi interaktif.
- **Dengan `--auto`**: fase `code`/`review` dijalankan sebagai sesi `omp -p`
  nyata (2 sesi/story: DEV lalu REVIEW), masing-masing menulis marker
  penyelesaian yang diverifikasi independen oleh adapter. Tanpa marker valid,
  fase gagal — stdout sesi tidak pernah dipercaya.
- Commit selalu oleh orchestrator setelah triage PASS, per story.
