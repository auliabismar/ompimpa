# Risalah Mufakat Balairung Sari — Panen `agyimpa` → `ompimpa` & Sinkronisasi Review Isolated

> **Sidang:** Balairung Sari — Musyawarah Meja Bundar Interaktif (Party Mode)  
> **Topik:** Komparasi `ompimpa` (Oh My Pi) vs `agyimpa` (agy-cli) — tujuan sama, harness berbeda; apa yang dipetik dari `agyimpa` untuk `ompimpa` + klarifikasi isolated reviewer & dev loop  
> **Tanggal:** 2026-09-02  
> **Ketua Sidang:** Pimpinan Majelis Balairung Sari  
> **Dewan Hadir:** Tan Malaka (TRIZ), Bung Hatta (Boundaries/Ash Spine), Sutan Sjahrir (OTP/BEAM), H. Agus Salim (PRD/BMM), Hj. Rasuna Said (Iron Laws), Bagindo Azizchan (Security), Mohammad Yamin (Docs), Tuanku Imam Bonjol (TEA)  
> **Status:** **Mufakat Diketuk — Sidang Ditutup**  
> **Artefak Rujukan:** Dapat dikutip oleh `/ompimpa:adr`, `/ompimpa:prd`, `/ompimpa:dev`

---

## 1. Ringkasan Eksekutif

`ompimpa` dan `agyimpa` berbagi **26 Iron Laws identik** dan **upstream identik** (`_upstream/bmad-cis, bmad-core, bmad-loop, bmad-tea, phxagents`) — perbedaan 100% pada **harness** dan **strategi reifikasi**. `ompimpa` = *thin TypeScript adapter* di OMP (1.169 ln inti, 10 skills, install 1 baris, TTSR realtime). `agyimpa` = *deterministic Python suite* di agy (23.7k ln, 71 skills, 12 engine, 35-Row scoring 100/100, 9-Review Squad). Mufakat: **jangan bulk-copy 71 skills / Python runtime** — panen **8 invarian ber-ROI tinggi + 5 perbaikan review loop**, port idiomatik ke TS/Bun.

---

## 2. Fakta Fondasi [FACT]

| Dimensi | `ompimpa` | `agyimpa` |
|---|---|---|
| Harness | `omp` — `hooks/ompimpa-guard.ts` + `xd://lsp/ast_edit/browser/hub`, DAG 32, worktree `~/.omp/wt/` | `agy` — `python3 .agents/scripts/*.py`, `hooks.json` 4 hooks, `.bmad-loop/bmad_loop_hook.py` |
| Bahasa | TS/Bun `src/cli.ts` 746 ln + `prewalk.ts` 227 + `reviewer.ts` 196 | Python 12 engine (29–77KB/file), `scripts/` 23.7k ln |
| Manifest | `.claude-plugin/plugin.json` + `.omp-plugin/plugin.json` MIT | `.agents/plugin.json` Apache-2.0 |
| Skills | `skills/` 10 + `commands/` 16 + `agents/` 14 + `rules/` 15 TTSR md | `.agents/skills/` 71 + `fase-*` 4 master + spesialis 4 |
| Iron Laws | 26 — agregat `rules/elixir-iron-laws.md` 6.3KB + 15 `rules/elixir-*.md` | 26 — 26 file terpisah `.agents/rules/iron-laws/01..26.md` |
| Lifecycle | 6 tahap 2 sesi `balairung→ideate→prd/adr→ui→dev→verify/doc` | 4 fase `analisis→rencana→solusi→eksekusi` + `balairung/inspeksi/dokumentasi/graphify` |
| Artifacts | `_ompimpa/` (`prd/`, `adr/`, `balairung/`, `solutions/`, `status/feature-status.yaml`) + `ompimpa.toml` | `_bmad-output/` (`analysis/domain-blueprint.md`, `planning-artifacts/prd.md|architecture-spine.md|stories.yaml`, `implementation-artifacts/spec-*.md`, `party-mode/balairung/`) + `_bmad/config.toml` |
| Quality | 4 Tier: TTSR→GuardHook→pre-commit <2s→6-agent review, floor 90, max_retries 3, `max_triage_fix_cycles=2` | 9-Review Squad (3 BMAD+6 phx) + 35-Row Registry 100/100, dedup hash, `max_retries_per_story=3`, 3-Tier verify |
| Review Engine | `src/reviewer.ts` `buildReviewPanel()` → 1 spec + 6 tech = 7 kontrak; `runReview()` saat ini hanya `runPrewalkScan()` inline | `execution_engine.py` + `loop_runner.py` + `triage_collector.py` dispatch 9 isolated subagent JSON → dedup → scoring |
| Tests | `bun test test/` 5 file | `python3 .agents/scripts/test_*.py` 17 file |
| Docs | `docs/` 9 file Diátaxis + skill `diataxis-documentation` | `docs/` 15 file via `dokumentasi_generator.py` 77KB deterministik |
| Distribusi | `omp plugin install github:auliabismar/ompimpa` | `cp -r .agents` + `python3 setup_wizard.py --greenfield/--brownfield` |
| Ukuran | 100 file (excl upstream) | 1.271 file (excl upstream/_bmad-output) |

---

## 3. Putusan Mufakat — Apa yang Dipetik (P0→P2)

### P0 — Wajib (1–2 hari, tanpa breaking)

| ID | Fitur Panen | Sumber `agyimpa` [FACT] | Adaptasi `ompimpa` | Kriteria Sukses |
|---|---|---|---|---|
| **F-01** | **Pecah 26 Iron Laws 1:1** | `.agents/rules/iron-laws/01..26.md` (26 file) | `rules/01-no-float-money.md` … `rules/26-pure-code-comments.md` — TTSR inject per-file, `reviewer.ts` audit per-hash | `rules/` 26 file, `loadPrewalkRules()` load 26, `test_iron_laws` hijau |
| **F-02** | **Stories YAML DAG + Kill Criteria** | `stories.yaml` (DAG `depends_on[]`), `domain-blueprint.md` Kill Criteria, `architecture-spine.md` 5 pilar Ash | `stories.yaml` + `kill_criteria` di `ompimpa.toml` + validasi circular di `prewalk.ts` | `stories.yaml` terurut topologis, `prewalk` blok siklus, Kill Criteria tampil di PRD |
| **F-03** | **Graphify Blast-Radius** | `graphify_engine.py` 57KB, `graph.json` | `src/graphify.ts` via `mix xref graph --format json` + `lsp references`, output `_ompimpa/graph.json` | `ompimpa graphify` <2s di 500 file, blast-radius tampil di review |

### P1 — Kuat (1 minggu, perlu ADR)

| ID | Fitur Panen | Sumber `agyimpa` | Adaptasi `ompimpa` | Kriteria Sukses |
|---|---|---|---|---|
| **F-04** | **35-Row Criteria Registry 100/100** | `criteria_registry_35.json` (5 dimensi TEA, penalti -30/-15/-5/-2), `triage_collector.py` 29KB | `_ompimpa/criteria_registry_35.json` port + `src/reviewer.ts:calculateScorecard` ganti penalti & floor 100 | Skor 100/100 deterministik, mapping reviewer_sources konsisten |
| **F-05** | **Triage Dedup Hash + P0→P2 Sorting** | `triage_collector.py` dedup `file:line:rule` keep severity tertinggi, `test_triage.py` 523 ln | `src/triage.ts` `deduplicateFindings()` + `remediationPlan()` sorted P0→P1→P2 | 3 laporan baris 42 sama → 1 entitas, penalti 1× |
| **F-06** | **Isolated Review Dispatch (7→10)** | `spec-4-1` 9-Review Squad, `execution_engine.py` `invoke_subagent` isolated | `src/reviewer.ts:dispatchIsolatedReview(panel)` → `task` 7 isolated (1 spec+6 tech), tulis `_ompimpa/review/<story>-<reviewer>.json`, aggregator dedup | Review via `task isolated:true`, bukan inline; 7 JSON terbit per story |
| **F-07** | **Spec Lens Split 1→3/4** | `bmad_adversarial/gap_verifier/structural` (3 BMAD), upstream 4 isolated terbaru | Pecah `enable_spec_review` (1) → `bmad_adversarial`, `bmad_gap_verifier`, `bmad_structural` (+ ke-4 jika BMAD 4) | 3–4 JSON spec terpisah, bukan 1 Agus Salim monolit |
| **F-08** | **Tiered Verification** | `loop_runner.py` Tier1 <2s / Tier2 <10s / Tier3 background | `ompimpa.toml [quality.verify]` pecah `tier1=["compile --warnings-as-errors","format"]`, `tier2=["test --stale"]`, `tier3=["test","credo --strict","sobelow"]` | `dev` loop hanya Tier1+2, Tier3 di `/verify` / background |
| **F-09** | **Deferred-Work + Sweep** | `deferred-work.md` + `bmad-loop sweep --no-prompt`, `loop_runner.py` 38KB | `_ompimpa/deferred.md` + `src/sweep.ts` + `ompimpa sweep` (worktree OMP, tanpa Python) | `ompimpa sweep` triage deferred → `ready-for-dev` |
| **F-10** | **Pitfalls Manager** | `pitfalls_manager.py` 18KB + `AGENTS.md` Known Pitfalls 6 entry | `rules/pitfalls.md` auto-append dari triage + inject ke prompt `compound-solutions` | Pitfalls tumbuh otomatis per REMEDIATE |

### P2 — Opsional (iteratif)

| ID | Fitur Panen | Sumber | Adaptasi | Catatan |
|---|---|---|---|---|
| **F-11** | Setup Wizard Greenfield/Brownfield | `setup_wizard.py` 54KB, `AGENTS.md` `scope=full/delta` | `src/cli.ts:handleInit` deteksi `mix.exs`+`lib/` → tulis `CLAUDE.md` varian | Jangan copy Python, cukup deteksi + template |
| **F-12** | Deterministic Docs Generator | `dokumentasi_generator.py` 77KB, `docs/` 15 file | `src/dokumentasi.ts` generate 4 kuadran dari `stories.yaml`+`adr/` | Iteratif, mulai 1 template |
| **F-13** | Inspeksi 4-Pilar Scorecard 0–100 | `inspeksi_engine.py` 59KB | `src/inspeksi.ts` scorecard batas/perf/keamanan/docs di `_ompimpa/inspeksi/report.md` | Butuh matriks, P2 |
| **F-14** | Naikkan `max_triage_fix_cycles` 2→3 | `policy.toml max_retries_per_story=3` | `templates/ompimpa.toml: max_triage_fix_cycles=3` | Sinkron circuit breaker 3 |

**Tidak dipetik:** Bulk 71 skills, Python runtime, `_bmad/` hierarchy 4-level — cost > value di OMP; `ompimpa` tetap 10 skills fokus, tambah 1 per kebutuhan.

---

## 4. Jawaban Tegas — Isolated Reviewer & Dev Loop

**Apakah sudah 4 isolated reviewer?** [FACT] **Belum.** `ompimpa` kontrak = **DUAL-REVIEW 1 spec + 6 tech = 7 isolated** (`commands/dev.md:33` invariant anti-inline, `templates/ompimpa.toml: parallel_reviewers=6`, `src/reviewer.ts:42` `buildReviewPanel` 1+6). `agyimpa` = **9 isolated** (3 BMAD + 6 phx). Upstream BMAD terbaru **4 isolated** — keduanya tertinggal 1. Realisasi `ompimpa` saat ini **masih inline** (`reviewer.ts:158` hanya `runPrewalkScan`) — ini **P1 gap** (F-06).

**Per story atau per epic?** [FACT] **Per STORY** di kedua repo. `agyimpa`: `stories.yaml` DAG per story → `LoopRunner` per story Tier1/Tier2 → REMEDIATE patch spec SAMA → re-review (max 3) → PASS → `.memlog.md` + `feat(scope):` → next story. `ompimpa`: `feature-status.yaml: ready-for-dev/in-progress/done` per story → `dev.md:18-32` ATDD RED→dispatch worktree→coding GREEN→DUAL-REVIEW→TRIAGE→re-review `max_triage_fix_cycles=2` → commit → `session_stop` lanjut story berikut. Full suite hanya di `/verify` / Tier3.

**Proses dev?** [FACT] **Ya, `story → dev → isolated review → triage → patch back to dev (sequential) → done`** — kontrak identik. `agyimpa` implement di `loop_runner.py` (3 retries, scoring 100, dedup). `ompimpa` kontrak di `dev.md:50-54` (2 cycles, scoring 90) — engine-nya belum, akan diperbaiki F-04/F-05/F-08.

---

## 5. Daftar Fitur yang Akan Dikerjakan (Backlog Eksekusi Berurutan)

### Epic A — Governance Spine (Fondasi)

| Story | Judul | Ketergantungan | Prioritas | Estimasi | AC Gherkin |
|---|---|---|---|---|---|
| **A-01** | Pecah 26 Laws 1:1 + TTSR per-file | — | P0 | S | *Given* `rules/` 26 file ada, *When* `bun test ttsr_rules.test.ts` jalan, *Then* tiap law ter-load & ter-inject terpisah |
| **A-02** | Stories YAML DAG + Kill Criteria | A-01 | P0 | S | *Given* `stories.yaml` 5 story DAG, *When* `prewalk` cek `depends_on` siklus, *Then* error pointed ke story penyebab |
| **A-03** | 35-Row Criteria Registry 100/100 | A-01 | P1 | M | *Given* 35 kriteria di `_ompimpa/criteria_registry_35.json`, *When* `review` hitung skor, *Then* `-30/-15/-5/-2`, `PASS` hanya `100` |

### Epic B — Isolated Review & Triage (Inti Mutu)

| Story | Judul | Ketergantungan | Prioritas | Estimasi | AC Gherkin |
|---|---|---|---|---|---|
| **B-01** | Dispatch 7 isolated via `task` | A-03 | P0 | M | *Given*story `in-progress`, *When* `dispatchIsolatedReview()` dipanggil, *Then* 7 `task isolated:true` tulis `_ompimpa/review/<story>-*.json` |
| **B-02** | Dedup hash + Remediation Plan P0→P2 | B-01 | P0 | S | *Given* 3 reviewer lapor `lib/foo.ex:42` sama, *When* aggregator dedup, *Then* 1 finding keep `Critical` |
| **B-03** | Split spec 1→3/4 BMAD lens | B-01 | P1 | M | *Given* `enable_spec_review`, *When* review jalan, *Then* 3 JSON `bmad_adversarial/gap/structural` terbit |
| **B-04** | Tiered Verification T1/T2/T3 | A-02 | P1 | S | *Given* `ompimpa.toml` tiered, *When* `dev` loop, *Then* hanya T1+T2 (<12s), T3 di `verify` |
| **B-05** | Naikkan cycles 2→3 + Circuit Breaker 3 | B-02 | P1 | S | *Given* REMEDIATE 3×, *When* `retries>=3`, *Then* `BLOCK` + eskalasi |

### Epic C — Knowledge & DX (Akselerator)

| Story | Judul | Ketergantungan | Prioritas | Estimasi | AC Gherkin |
|---|---|---|---|---|---|
| **C-01** | Graphify blast-radius via `mix xref` | A-02 | P0 | M | *Given* ubah `lib/accounts.ex`, *When* `ompimpa graphify`, *Then* `_ompimpa/graph.json` list `live/*.ex` terdampak |
| **C-02** | Deferred-work + `ompimpa sweep` | B-02 | P1 | M | *Given* `deferred.md` 2 item, *When* `ompimpa sweep`, *Then* dipromote ke `ready-for-dev` |
| **C-03** | Pitfalls auto-append | B-02 | P1 | S | *Given* REMEDIATE sukses, *When* commit, *Then* `rules/pitfalls.md` bertambah 1 entry |
| **C-04** | Setup Wizard Greenfield/Brownfield | A-02 | P2 | M | *Given* `mix.exs` ada, *When* `ompimpa init`, *Then* `CLAUDE.md` tulis `Brownfield scope=delta` |
| **C-05** | Docs Generator deterministik | A-02 | P2 | M | *Given* `stories.yaml`, *When* `ompimpa doc`, *Then* `docs/tutorials/01-getting-started.md` auto-sync |
| **C-06** | Inspeksi 4-Pilar scorecard | A-03 | P2 | M | *Given* `ompimpa review`, *When* selesai, *Then* `_ompimpa/inspeksi/report.md` skor 0–100 4 pilar |

**Urutan Eksekusi Rekomendasi (DAG):** `A-01 → A-02 → A-03 → B-01 → B-02 → C-01 → B-03 → B-04 → B-05 → C-02 → C-03 → C-04 → C-05 → C-06`

---

## 6. Kill Criteria & Guardrails

- Jika `graphify` >2s di 500 file → rollback ke `lsp` lazy, jangan blok dev loop. [INFERENCE]
- Jika 26 file laws bikin prompt >8k token → revert ke agregat lazy-load per-law. [INFERENCE]
- Jika dedup hash salah merge beda kategori same line → fix `triage.ts` clustering by `ruleId`, bukan hanya `line`. [FACT agyimpa `test_triage.py` low patch]
- Jika Tier1+2 >12s → pecah lagi, jangan jalankan Tier3 di loop.

---

## 7. Suara Berbeda (Preserved Dissent)

- **Tan Malaka:** Menolak port Python verbatim — engine harus TS native, bukan `Bun.spawn(python3)`. Jika tim memaksa Opsi B (thin adapter), ia dissent.
- **Sutan Sjahrir:** Menolak bulk 71 skills — pertahankan 10 skills fokus; tambahan skill hanya on-demand. Jika di-copy semua, ia dissent.

---

## 8. Tindak Lanjut

- **ADR:** `ADR-XXX: Panen agyimpa — 35-Row Registry & Isolated Review 7→10` (via `/ompimpa:adr "Isolated Review & Criteria Registry"`)
- **PRD/Backlog:** Epic A→C di atas → `_ompimpa/prd/` + `stories.yaml` (via `/ompimpa:prd`)
- **Dev:** `/ompimpa:dev --story A-01` mulai gelombang 1 (pecah 26 laws)
- **Verify:** `/ompimpa:verify` Tier3 setelah Epic B selesai

---

*Risalah dicatat otomatis Balairung Sari — dapat dikutip kapan saja. Sidang dinyatakan tertutup.*
