# ADR-001: Panen `agyimpa` — 35-Row Criteria Registry, Isolated Review 7→10 & Tiered Verification di `ompimpa`

> **Status:** Accepted — 2026-09-02  
> **Deciders:** Dewan Balairung Sari (Tan Malaka, Bung Hatta, Sutan Sjahrir, H. Agus Salim, Hj. Rasuna Said, Bagindo Azizchan, Tuanku Imam Bonjol) — Ketua Sidang  
> **Rujukan:** `_ompimpa/balairung/BALAIRUNG-20260902-panen-agyimpa-review-sync.md`  
> **Tags:** `review`, `quality-gate`, `iron-laws`, `triage`, `ompimpa`, `agyimpa`, `MADR-3.0`  
> **Supersedes:** —  
> **Amends:** `templates/ompimpa.toml` `[quality]`, `[quality.review]`, `[quality.verify]`; `src/reviewer.ts`; `rules/`

---

## 1. Context and Problem Statement

`ompimpa` (Oh My Pi, TS/Bun, 10 skills, 1.169 ln inti) dan `agyimpa` (agy-cli, Python 23.7k ln, 71 skills) berbagi tujuan identik — workshop otonom Elixir/Phoenix/Ash/LiveView/Ecto/Oban bertenaga 26 Iron Laws — dan upstream identik (`_upstream/bmad-*`, `phxagents`). Perbedaan harness menyebabkan divergensi mutu:

*   `ompimpa` kontrak **DUAL-REVIEW 1 spec + 6 tech = 7** (`commands/dev.md:33` invariant anti-inline, `templates/ompimpa.toml: parallel_reviewers=6`) tetapi realisasi `src/reviewer.ts:147-196` masih **inline `runPrewalkScan()`** tanpa dispatch `task isolated:true` — P1 spec-reality gap, scoring longgar `floor 90` penalti `-25/-10/-3` tanpa dedup hash.
*   `agyimpa` sudah **9 isolated** (3 BMAD `adversarial/gap/structural` + 6 phxagents) via `execution_engine.py` + `loop_runner.py`, **35-Row Criteria Registry** `criteria_registry_35.json` (5 dimensi TEA, penalti `-30/-15/-5/-2`, dedup `file:line:rule` keep `Critical`, `PASS` hanya `100/100`), **3-Tier verification** (`<2s` T1 compile+format, `<10s` T2 `test --stale`+review, background T3 full+credo+sobelow), `max_retries_per_story=3`.
*   `ompimpa` belum punya: `stories.yaml` DAG, registry 35 baris, graphify blast-radius, deferred-work+sweep, pitfalls auto-append — semua ada di `agyimpa` dan terbukti lewat 17 `test_*.py` hijau.

Pertanyaan arsitektur: **apa yang dipetik dari `agyimpa` ke `ompimpa` tanpa mengimpor Python runtime dan 71-skill bloat?**

---

## 2. Decision Drivers

*   **D1 — Determinisme:** Review harus skor matematis, bukan narasi LLM — dedup + registry jadi single source of truth (agya `triage_collector.py` lulus 21 tests).
*   **D2 — Anti-bias:** Review wajib isolated subagent (`task isolated:true`) agar penulis kode tidak menilai karyanya sendiri (`dev.md` invariant).
*   **D3 — Hemat token & cepat:** OMP TTSR Tier0 sudah hemat 60–80% via `compactTestOutput`; isolated review tidak boleh menambah >12s per story (T1+T2).
*   **D4 — Modularitas BEAM:** `ompimpa` harus tetap toggle `use_ash_framework/use_oban` — registry & graphify tidak boleh hardcode Ash.
*   **D5 — Maintainability:** 10 skills fokus > 71 skills blanket; panen invarian, bukan file count (100 vs 1.271 file).
*   **D6 — Sinkron upstream:** BMAD terbaru 4 isolated workers — `agyimpa` masih 3, `ompimpa` 1 — keduanya harus sinkron.

---

## 3. Considered Options

### Opsi A — Status Quo (Tolak Panen)
Biarkan `ompimpa` 7-kontrak/1-inline, floor 90, tanpa registry, tanpa graphify. Dev loop tetap jalan via prompt manual.

*   **Pro:** 0 effort, 0 risiko regresi.
*   **Kontra:** Scoring semu (3 reviewer lapor baris 42 → potong 3×), no dedup, no blast-radius, P1 gap tetap, divergensi BMAD 4-worker tidak tersinkron. [INFERENCE] Loop REMEDIATE bisa salah eskalasi.

### Opsi B — Thin Adapter (Import Python)
`ompimpa` `Bun.spawn(python3 .agents/scripts/triage_collector.py)` & `loop_runner.py` langsung — reuse 23.7k ln Python.

*   **Pro:** Instant 35-Row + 9 reviewers tanpa rewrite.
*   **Kontra:** Tambah dependensi `python3` di OMP harness (Bun world), duplikat `_bmad/` hierarchy, langgar D5, maintenance ganda upstream. Ditolak dewan (Tan Malaka dissent).

### Opsi C — **Panen Selektif TS-Native (Dipilih)**
Port **invarian** agyimpa ke `ompimpa` secara idiomatik TS/Bun, tanpa Python runtime: 14 story (Epic A-C) — lihat §5. Registry, dedup, isolated dispatch, tiered verify, 26 laws 1:1, graphify via `mix xref`, deferred+sweep, pitfalls — semua TS.

*   **Pro:** Determinisme + hemat token + tetap 10 skills fokus + OMP-native (`xd://lsp`, `hub`, `mix xref`). Sinkron BMAD 4-worker via split spec lens.
*   **Kontra:** Effort M (2–3 minggu), perlu migrasi `calculateScorecard` & `ompimpa.toml` breaking (floor 90→100) — mitigasi via feature flag `quality.review.scoring_version`.

---

## 4. Decision Outcome

**Dipilih Opsi C.**

`ompimpa` akan mengimplementasikan **14 story** berikut secara berurutan DAG — rujukan penuh `BALAIRUNG-20260902-panen-agyimpa-review-sync.md` §5:

**Epic A — Governance Spine**
*   **A-01** Pecah `rules/elixir-iron-laws.md` agregat → 26 file `rules/01-..26-*.md` 1:1 (TTSR per-file).
*   **A-02** `stories.yaml` DAG `depends_on[]` + `kill_criteria` di `ompimpa.toml` + validasi circular `prewalk.ts`.
*   **A-03** `_ompimpa/criteria_registry_35.json` port dari `agyimpa/.agents/data/criteria_registry_35.json` (5 dimensi TEA, penalti `-30/-15/-5/-2`).

**Epic B — Isolated Review & Triage**
*   **B-01** `src/reviewer.ts:dispatchIsolatedReview(panel)` → 7 `task isolated:true` tulis `_ompimpa/review/<story>-<reviewer>.json`.
*   **B-02** `src/triage.ts` dedup hash `file:line:ruleId` keep `Critical`, Remediation Plan sorted P0→P1→P2.
*   **B-03** Split `enable_spec_review` (1 Agus Salim) → 3/4 BMAD lens (`adversarial/gap/structural` [+ ke-4 BMAD terbaru]) — sinkron 4 isolated.
*   **B-04** Tiered verify: `quality.verify.tier1=["compile --warnings-as-errors","format"]` `<2s`, `tier2=["test --stale"]` `<10s`, `tier3=["test","credo --strict","sobelow"]` background — dev loop hanya T1+T2.
*   **B-05** `max_triage_fix_cycles: 2→3` sinkron `max_dev_retries=3`.

**Epic C — Knowledge & DX**
*   **C-01** `src/graphify.ts` via `mix xref graph --format json` + `lsp references` → `_ompimpa/graph.json` blast-radius.
*   **C-02** `_ompimpa/deferred.md` + `src/sweep.ts` + `ompimpa sweep` (worktree OMP, tanpa Python).
*   **C-03** `rules/pitfalls.md` auto-append dari triage → inject `compound-solutions`.
*   **C-04** Setup Wizard Greenfield/Brownfield (`handleInit` deteksi `mix.exs`).
*   **C-05** Docs generator deterministik `src/dokumentasi.ts` 4 kuadran.
*   **C-06** Inspeksi 4-pilar scorecard `_ompimpa/inspeksi/report.md`.

Scoring baru: `Score = max(0, 100 - (Critical×30 + High×15 + Medium×5 + Low×2))`, `PASS` iff `score==100 && 0 P0 && 0 Critical/High`, bobot `spec*0.4+tech*0.6` dipertahankan atau dihapus — diputuskan di B-02.

---

## 5. Consequences

### Positif
*   Review deterministik, dedup benar, skor 100/100 transparan — `triage` bisa di-unit-test tanpa LLM (port `test_triage.py` 21 tests → `bun:test`).
*   Isolated 7→10 menghilangkan bias konfirmasi, sesuai invariant anti-inline.
*   Tiered verify hemat 60–80% token + <12s per story, full suite tidak blok inner loop.
*   Graphify cegah regresi cross-context (mis. ubah `Accounts` pecah `LiveView`).
*   Tetap OMP-native, tanpa Python, 10 skills fokus.

### Negatif / Mitigasi
*   **Breaking `floor 90→100`:** Story lama yang lulus 90 bisa BLOCKED — mitigasi: `quality.review.scoring_version="v2"` flag, migrasi bertahap, `doctor` warning.
*   **Latency isolated 7:** 7 `task` paralel tambah ~4–6s — mitigasi: `parallel_reviewers` configurable, fallback inline jika `hub` down.
*   **Effort:** ~14 story — mitigasi: gelombang 1 (A-01,A-02,C-01) dulu, 1–2 hari.

---

## 6. Enforced Invariants (Hukum Besi Baru)

*   **INV-01 Anti-Inline:** `src/reviewer.ts:runReview` DILARANG inline — wajib `dispatchIsolatedReview` via `task isolated:true`. Pelanggaran → `prewalk` P0.
*   **INV-02 Dedup:** Triage wajib dedup `file:line:ruleId` keep severity tertinggi — penalti 1× per entitas unik. Tanpa dedup → skor invalid.
*   **INV-03 Score Gate:** `PASS` hanya `100/100` + 0 P0/Critical/High — `allow_p2_nits=false` default.
*   **INV-04 Same-Spec:** Loop REMEDIATE iterasi 1..3 wajib pakai **SPEC SAMA** — dilarang drift AC Gherkin.
*   **INV-05 Tier Budget:** T1 <2s, T2 <10s — dilarang jalankan `dialyzer`/`credo --strict` di T1/T2.
*   **INV-06 Worktree Isolation:** `dev` dispatch spesialis wajib `use_git_worktrees=true` (`~/.omp/wt/`).

---

## 7. References

*   Balairung: `_ompimpa/balairung/BALAIRUNG-20260902-panen-agyimpa-review-sync.md`
*   Sumber agyimpa: `.agents/data/criteria_registry_35.json`, `.agents/scripts/triage_collector.py` 29KB, `loop_runner.py` 38KB, `graphify_engine.py` 57KB, `execution_engine.py`, `spec-4-1` 9-Review Squad, `spec-4-2` 35-Row, `spec-4-3` Zero-Gap Loop
*   Ompimpa terdampak: `src/reviewer.ts`, `src/prewalk.ts`, `src/graphify.ts` (baru), `src/triage.ts` (baru), `hooks/ompimpa-guard.ts`, `templates/ompimpa.toml`

---

*Disusun oleh H. Agus Salim (ompimpa-prd) — MADR 3.0+*
