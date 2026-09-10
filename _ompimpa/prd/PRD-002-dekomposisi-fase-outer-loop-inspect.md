# PRD-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, & Unifikasi Master Diagnostic `/inspect`

> **Status:** Draft — Ready for Implementation  
> **Versi:** 2.0.0  
> **Tanggal:** 2026-09-03  
> **Owner:** H. Agus Salim (`ompimpa-prd`) — Dewan Balairung Sari  
> **Rujukan:** `_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md`, `_ompimpa/balairung/BALAIRUNG-20260903-outer-loop-isolated-review-tea-unification.md`, `_ompimpa/stories.yaml`  
> **Stack:** `omp` harness · TS/Bun native · Elixir/Phoenix/Ash/LiveView · 26 Iron Laws

---

## 1. Ringkasan Eksekutif

Menindaklanjuti ketetapan **ADR-002**, PRD ini menetapkan spesifikasi fungsional untuk mengakhiri *spec-reality gap* pada sistem review, memecah monolit `/dev` menjadi fase rekayasa modular independen, mendudukkan `bin/ompimpa dev` sebagai *Outer Loop Driver* anti-*context rot*, mengintegrasikan 3 instrumen BMAD-TEA secara *in-band*, dan menyatukan seluruh instrumen diagnostik ke dalam satu perintah master: **`/ompimpa:inspect`**.

---

## 2. Ruang Lingkup (Scope vs Non-Goals)

### In Scope
1. **Dekomposisi 5 Perintah Fase Mandiri:**
   - `/story <ID>`: Scaffolding spesifikasi mikro JIT (`_ompimpa/specs/SPEC-[ID].md`).
   - `/atdd <ID>`: Red-Phase ATDD scaffolding dari kriteria Gherkin JIT.
   - `/code <ID>`: Implementasi koding hijau oleh spesialis stack.
   - `/review <ID>`: Dispatch paralel 10 subagent isolated review (4 BMAD Spec + 6 Tech) via batch tool `task`.
   - `/triage <ID>`: Deduplikasi hash `file:line:ruleId`, kalkulasi skor 100/100, dan Remediation Plan.
2. **Outer CLI Driver (`bin/ompimpa dev --epic <ID> --auto`):**
   - Menghubungkan while-loop antar-story di level OS shell dengan *fresh context* per fase.
   - Auto-commit semantik dan pembaruan status `feature-status.yaml` saat skor 100/100.
3. **Pembersihan Mocking `src/reviewer.ts`:**
   - Menghapus scanner inline palsu di `dispatchIsolatedReview()`.
   - Memastikan berkas JSON di `_ompimpa/review/` diisi murni oleh subagent.
4. **Adopsi 3 Instrumen BMAD-TEA In-Band:**
   - TEA-01: Traceability Matrix (100% AC Gherkin terikat ke asersi tes).
   - Flaky & Latency Hunter: Melarang `Process.sleep` dan membatasi tes in-process <50ms.
   - Assertion Mutation Guard: Melarang asersi longgar demi mencegah *false greens*.
5. **Unifikasi Diagnostic Out-of-Band (`/ompimpa:inspect`):**
   - Menyatukan `audit`, `boundaries`, `perf`, dan `techdebt` ke dalam `/inspect`.
   - Otomatis menerbitkan temuan P0/P1 menjadi `EPIC-DEBT` di `stories.yaml`.

### Non-Goals (Out of Scope)
* Membangun server MCP Graphify (dibatalkan demi efisiensi).
* Membangun TUI curses/terminal wrapper eksternal (mengandalkan UI native OMP).
* Mengubah 26 Hukum Besi Elixir yang sudah terkunci.

---

## 3. Functional Requirements (FR)

| ID | Kebutuhan Fungsional | Komponen / Perintah | Acceptance Criteria |
|---|---|---|---|
| **FR-D01** | Spesifikasi Mikro Just-In-Time | `/ompimpa:story <ID>` | Menghasilkan `_ompimpa/specs/SPEC-[ID].md` memuat Gherkin presisi, signature fungsi, dan blast-radius file. |
| **FR-D02** | Scaffolding ATDD Mandiri | `/atdd <ID>` | Menghasilkan tes merah di `test/` yang memetakan 100% skenario Gherkin (TEA-01) dengan asersi failing. |
| **FR-D03** | Eksekusi Koding Mandiri | `/code <ID>` | Mengimplementasikan kode produksi hingga seluruh asersi tes berstatus hijau. |
| **FR-D04** | Dispatch 10 Reviewer Sejati | `/review <ID>` | Men-dispatch 10 subagent via `task(isolated: true)` menulis 10 JSON independen di `_ompimpa/review/`. |
| **FR-D05** | Triage & Scoring Deterministik | `/triage <ID>` | Membaca 10 JSON, dedup `file:line:ruleId`, hitung skor 100/100, dan terbitkan tabel Remediation Plan. |
| **FR-D06** | Outer Loop Orchestration | `bin/ompimpa dev --epic` | Mampu meloop sekuensial per story dalam Epic di level OS shell hingga seluruh story done. |
| **FR-D07** | In-Band TEA Quality Gate | `/review` & `/triage` | Mengganjar P1 High jika ada AC tanpa tes, tes mengandung `sleep`, atau asersi longgar. |
| **FR-D08** | Master Inspect Out-of-Band | `/ompimpa:inspect` | Memindai boundaries, perf, security, dan techdebt, lalu mentriage ke `EPIC-DEBT` di `stories.yaml`. |

---

## 4. Rincian Epics & User Stories (Epic D & Epic E)

### EPIC-D: Outer Loop Driver & Command Modularization
1. **D-01 (Story JIT Spec Generator):** Implementasikan `commands/story.md` dan logic generator `_ompimpa/specs/SPEC-[ID].md`.
2. **D-02 (Modular Commands & Refaktor /dev):** Buat `commands/code.md`, `commands/triage.md`, dan perbarui `commands/dev.md` menjadi pipeline coordinator.
3. **D-03 (Penegakan 10 Isolated Reviewers):** Perbarui `commands/review.md` dengan template dispatch tool `task` untuk 10 subagent dan bersihkan mock inline di `src/reviewer.ts`.
4. **D-04 (Outer CLI Loop Runner):** Implementasikan `src/loop_runner.ts` dan hubungkan `handleDev` di `src/cli.ts` agar mengeksekusi subprocess OMP sekuensial per story.

### EPIC-E: In-Band TEA Instruments & Master Inspect Unification
1. **E-01 (TEA-01 Traceability & Mutation Guard):** Tambahkan validasi kelengkapan AC dan deteksi asersi bodong di `bmad_gap_verifier` dan `src/triage.ts`.
2. **E-02 (Flaky & Slow Test Hunter):** Tambahkan scanner anti-sleep dan latensi >50ms pada `ompimpa-test` dan `src/reviewer.ts`.
3. **E-03 (Master Diagnostic /inspect):** Satukan `audit`, `boundaries`, `perf`, dan `techdebt` ke dalam `commands/inspect.md` dan implementasikan parser auto-story generator ke `_ompimpa/stories.yaml`.

---

*Disahkan oleh Dewan Balairung Sari & Ketua Sidang — BMM Product Governance*
