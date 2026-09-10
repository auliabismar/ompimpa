# PRD-001: Panen `agyimpa` → `ompimpa` — Deterministic Review & Knowledge Spine

> **Status:** Draft — Ready for Review  
> **Versi:** 1.0.0  
> **Tanggal:** 2026-09-02  
> **Owner:** H. Agus Salim (ompimpa-prd) — Dewan Balairung Sari  
> **Rujukan:** `ADR-001-panen-agyimpa-isolated-review-criteria-registry.md`, `BALAIRUNG-20260902-panen-agyimpa-review-sync.md`, `_ompimpa/stories.yaml` (14 stories), `_ompimpa/criteria_registry_35.json` (35-Row v2)  
> **Stack:** `omp` harness · TS/Bun native · Elixir 1.15+ · Phoenix 1.7+ · Ash 3.0+ (toggle) · LiveView · Ecto · Oban  
> **Artifacts Dir:** `_ompimpa/` · Scoring v2 `100/100` · Tiered `T1<2s/T2<10s/T3 bg`

---

## 1. Ringkasan Eksekutif

`ompimpa` berbagi 26 Iron Laws & upstream identik dengan `agyimpa`, tetapi realisasi review masih inline (`runPrewalkScan` saja) dengan scoring longgar `90/-25/-10/-3` tanpa dedup, tanpa DAG stories, tanpa graph blast-radius, dan tanpa deferred/pitfalls. `agyimpa` telah membuktikan determinisme via 9 isolated reviewers + 35-Row Registry `100/-30/-15/-5/-2` + 3-Tier verify + graphify + loop_runner (17 `test_*.py` hijau).

PRD ini mengunci **panen selektif TS-native (Opsi C ADR-001)**: port invarian `agyimpa` ke `ompimpa` tanpa Python runtime, dalam **3 Epic · 14 Stories DAG** yang dapat dieksekusi via `ompimpa dev` per story dengan closed-loop `isolated review → triage dedup → patch → re-review (max 3)` dan invariant anti-inline.

**Outcome terukur:** Review deterministik 100/100, dedup benar (3 laporan baris 42 → 1 entitas), T1+T2 <12s di i5-8250U, graphify <2s di 500 file, 0 spec drift.

---

## 2. Scope vs Non-Goals

### In Scope
*   Pecah `rules/elixir-iron-laws.md` agregat → 26 file `rules/01..26-*.md` 1:1 TTSR per-law.
*   `stories.yaml` DAG topologis + kill criteria + `feature-status.yaml` dev loop.
*   Port 35-Row Criteria Registry `100/100` (`-30/-15/-5/-2`) + dedup hash `file:line:ruleId` + `PASS iff 100`.
*   Isolated review 7 (1 spec + 6 tech) → 10 (4 BMAD lens + 6 tech) via `task isolated:true`.
*   Tiered verification T1/T2/T3, `max_triage_fix_cycles 2→3`.
*   Graphify `mix xref` blast-radius, deferred-work + `sweep`, pitfalls auto-append, wizard Greenfield/Brownfield, docs generator, inspeksi 4-pilar (P2 iteratif).

### Non-Goals (Out of Scope)
*   Bulk-copy 71 skills `agyimpa` → `ompimpa` tetap 10 skills fokus.
*   Import Python runtime (`Bun.spawn(python3)`) — semua port TS native.
*   Rewrite `src/cli.ts` god-file total — hanya segmentasi engine per story.
*   Full Dialyzer di T1/T2 — Dialyzer hanya T3 background.

---

## 3. Functional Requirements (FR)

| ID | Requirement | Stories | Kriteria Registry | Iron Law |
|---|---|---|---|---|
| **FR-01** | 26 Laws harus 1 file 1 law, TTSR inject per-law, audit per-hash | A-01 | TEA-17, TEA-08 | #1, #8, #12, #17, #22 |
| **FR-02** | Stories harus DAG bebas siklus, topo-sort deterministik, `depends_on` enforced | A-02 | TEA-16, TEA-15 | #16 |
| **FR-03** | Scoring harus 35-Row `100 - sum(Crit30+High15+Med5+Low2)`, `PASS==100`, `allow_p2_nits=false` | A-03 | TEA-29, TEA-30 | — |
| **FR-04** | Review harus 7→10 isolated `task isolated:true`, tiap tulis JSON `severity/file/line/rule_violation/recommendation` | B-01, B-03 | TEA-01, TEA-29 | #23 |
| **FR-05** | Triage dedup `file:line:ruleId` keep `Critical>High>Med>Low`, sorted P0→P1→P2 | B-02 | TEA-29 | — |
| **FR-06** | Verifikasi Tiered T1<2s T2<10s T3 bg, dev loop hanya T1+T2 | B-04 | TEA-26 | #26 |
| **FR-07** | Circuit breaker `max_triage 3` + `max_dev_retries 3` → escalate | B-05 | — | — |
| **FR-08** | Graph blast-radius `mix xref graph` → `_ompimpa/graph.json` <2s | C-01 | TEA-15, TEA-16 | — |
| **FR-09** | Deferred-work antrian P2 + `ompimpa sweep` promote `ready-for-dev` | C-02 | TEA-35 | — |
| **FR-10** | Pitfalls auto-append `rules/pitfalls.md` + `SOL-*.md` per REMEDIATE | C-03 | TEA-35 | #26 |
| **FR-11** | Setup wizard deteksi Greenfield/Brownfield → `CLAUDE.md` varian | C-04 | — | — |
| **FR-12** | Docs generator 4 kuadran Diátaxis dari `stories.yaml`+`adr`+`graph` | C-05 | TEA-35 | #14 |
| **FR-13** | Inspeksi 4-pilar scorecard `0–100` → `_ompimpa/inspeksi/report.md` | C-06 | TEA-15,24,08 | — |

---

## 4. Non-Functional Requirements (NFR)

| ID | NFR | Target | Stories | Verifikasi |
|---|---|---|---|---|
| **NFR-01** | Inner loop latency | T1 <2s, T1+T2 <12s di i5-8250U (WSL2) | B-04 | `bun test` timer + `time ompimpa dev` |
| **NFR-02** | Graphify latency | <2s di 500 file Elixir | C-01 | `time ompimpa graphify` |
| **NFR-03** | Determinisme review | Skor sama untuk diff sama, dedup 3→1 benar | B-02 | `triage.test.ts` 21 tests port |
| **NFR-04** | Scoring gate | `PASS` hanya `100/100 && 0 P0/Crit/High` | A-03, B-02 | `reviewer.test.ts` |
| **NFR-05** | Isolation | 7→10 `task isolated:true`, worktree `~/.omp/wt/` | B-01 | `review_isolated.test.ts` |
| **NFR-06** | Token efficiency | TTSR hemat 60–80% via `compactTestOutput` tetap | A-01 | `hooks.test.ts` |
| **NFR-07** | Modularitas | `use_ash_framework/use_oban` toggle, registry tidak hardcode Ash | A-03 | `doctor` + brownfield test |

---

## 5. Epics Spine — 14 Stories DAG

> **Sumber kanonik:** `_ompimpa/stories.yaml` (20 KB, topo-sort validated `cycle=none`).
> Urutan eksekusi: `A-01 → A-02/A-03 → B-01 → B-02 → C-01/B-03/B-04/B-05 → C-02/C-03 → C-04/C-05/C-06`.
> Status: `backlog:14` (paused per instruksi user, belum `ready-for-dev`).

### Epic A — Governance Spine (Fondasi Deterministik)

#### A-01 — Pecah 26 Iron Laws Agregat → 26 File 1:1 TTSR per-Law
*   **Priority:** P0 · **Tea Tier:** P0 · **Estimate:** S · **Depends:** [] · **Assignee:** ompimpa-ironlaw
*   **Target:** `rules/01-no-float-money.md` … `rules/26-pure-code-comments-and-verification.md` (26 file) + `src/prewalk.ts` + `test/ttsr_rules.test.ts`
*   **AC:**
    *   **AC-A01-1:** *Given* `rules/` berisi 26 file `01..26` sinkron `agyimpa 01..26`, *When* `loadPrewalkRules()` dipanggil, *Then* 26 rules ter-load 1:1 tanpa duplikat.
    *   **AC-A01-2:** *Given* kode `field :balance, :float`, *When* TTSR stream intersepsi `edit/write`, *Then* rule `01-no-float-money` abort dengan remediation `gunakan :decimal atau integer cents` di line tepat.
    *   **AC-A01-3:** *Given* legacy `elixir-iron-laws.md` masih ada, *When* A-01 selesai, *Then* header `> DEPRECATED: use rules/01..26` tanpa hapus dulu.
*   **Kill:** Inject 26 file >8k token → fallback lazy-load per-law.

#### A-02 — Stories YAML DAG Topologis + Kill Criteria Eksplisit
*   **Priority:** P0 · **Tea Tier:** P0 · **Estimate:** S · **Depends:** [A-01] · **Assignee:** ompimpa-prd
*   **Target:** `_ompimpa/stories.yaml`, `_ompimpa/status/feature-status.yaml`, `src/prewalk.ts:checkCircularDAG()`, `test/stories_dag.test.ts`
*   **AC:**
    *   **AC-A02-1:** *Given* 14 story `A-01..C-06` dengan `depends_on` DAG, *When* `checkCircularDAG()` jalan, *Then* 0 siklus, sort `A-01→A-02→A-03→B-01→B-02→C-01→B-03→B-04→B-05→C-02→C-03→C-04→C-05→C-06`.
    *   **AC-A02-2:** *Given* `A-02 deps [A-01]` dan `A-01` not done, *When* `ompimpa dev --story A-02`, *Then* blok `Blocked: dependency A-01 not done`.
    *   **AC-A02-3:** *Given* `kill_criteria` per story, *When* PRD dirender, *Then* tampil di `_ompimpa/prd/` & LSP hover.
*   **Kill:** DAG check >500ms di 100 story → cache `_ompimpa/.cache/dag.json`.

#### A-03 — Port 35-Row Criteria Registry 100/100
*   **Priority:** P0 · **Tea Tier:** P1 · **Estimate:** M · **Depends:** [A-01] · **Assignee:** ompimpa-test
*   **Target:** `_ompimpa/criteria_registry_35.json` (35 rows, 5 dimensi, `-30/-15/-5/-2`), `src/reviewer.ts v2`, `src/triage.ts`, `test/triage.test.ts` (21 tests port)
*   **AC:**
    *   **AC-A03-1:** *Given* 35 kriteria `TEA-01..35`, *When* `loadRegistry()` dipanggil, *Then* 35 valid, `ompimpa_panel` ter-mapping (mis. `TEA-08→ompimpa-security`).
    *   **AC-A03-2:** *Given* `1 Crit(-30)+1 High(-15)`, *When* `calculateScore() v2`, *Then* `55 REMEDIATE P0=1 P1=1`.
    *   **AC-A03-3:** *Given* `0 temuan`, *When* `calculateScore() v2`, *Then* `100 PASS`, Low tetap `BLOCK` jika `allow_p2_nits=false`.
*   **Kill:** Floor `100` bikin story lama `90` BLOCKED → fallback `scoring_version=v1` flag.

### Epic B — Isolated Review & Triage

#### B-01 — Dispatch 7 Isolated Reviewers via `task isolated:true`
*   **Priority:** P0 · **Tea Tier:** P0 · **Estimate:** M · **Depends:** [A-03] · **Assignee:** ompimpa-prd
*   **Target:** `src/reviewer.ts:dispatchIsolatedReview()`, `_ompimpa/review/<story>-<reviewer>.json` (7 file)
*   **AC:**
    *   **AC-B01-1:** *Given* story `in-progress` panel 7 aktif, *When* `dispatchIsolatedReview()` dipanggil, *Then* 7 `task isolated:true` tulis JSON valid `severity/file/line/rule_violation/recommendation` atau `[]`.
    *   **AC-B01-2:** *Given* 1 reviewer crash, *When* `aggregateReviews()` timeout 60s, *Then* catat `P1 High reviewer missing` bukan crash.
    *   **AC-B01-3:** *Given* `runReview()` tanpa dispatch, *When* prewalk cek INV-01, *Then* `P0 Blocker Review must be isolated via task`.
*   **Kill:** 7 task >12s → fallback `parallel_reviewers=4`.

#### B-02 — Triage Dedup Hash `file:line:ruleId` + Remediation Plan P0→P1→P2
*   **Priority:** P0 · **Tea Tier:** P0 · **Estimate:** M · **Depends:** [B-01] · **Assignee:** ompimpa-test
*   **Target:** `src/triage.ts` (`deduplicateFindings`, `calculateScore`, `remediationPlan`)
*   **AC:**
    *   **AC-B02-1:** *Given* 3 reviewer lapor `foo.ex:42 IL-01` sama, *When* dedup, *Then* 1 entitas P0 `merged_sources=3` penalti 1× `-30`.
    *   **AC-B02-2:** *Given* beda rule same line `IL-01 vs IL-04`, *When* dedup, *Then* 2 entitas terpisah.
    *   **AC-B02-3:** *Given* `line=null` (file-level), *When* dedup, *Then* kunci `file:ruleId` didukung.
    *   **AC-B02-4:** *Given* `1C+1H+1M`, *When* score v2, *Then* `50 REMEDIATE` sorted `P0→P1→P2`.
*   **Kill:** Salah merge beda kategori → fix clustering `category+ruleId`.

#### B-03 — Split Spec 1→3/4 BMAD Lens
*   **Priority:** P1 · **Tea Tier:** P1 · **Estimate:** M · **Depends:** [B-01] · **Assignee:** ompimpa-prd
*   **Target:** `src/reviewer.ts:buildReviewPanel` split spec
*   **AC:**
    *   **AC-B03-1:** *Given* `enable_spec_review` + upstream 4, *When* `buildReviewPanel()` dipanggil, *Then* spec=4 total panel `10`.
    *   **AC-B03-2:** *Given* story `AC-1.1, AC-1.2`, *When* `gap_verifier` jalan, *Then* cek TEA-01 miss 1 AC → High.

#### B-04 — Tiered Verification T1<2s / T2<10s / T3 Background
*   **Priority:** P1 · **Tea Tier:** P1 · **Estimate:** S · **Depends:** [A-02] · **Assignee:** ompimpa-verify
*   **Target:** `templates/ompimpa.toml [quality.verify.tier1/tier2/tier3]`
*   **AC:**
    *   **AC-B04-1:** *Given* tiered terdefinisi, *When* `ompimpa dev`, *Then* hanya `T1+T2 <12s`, T3 di `/verify`.
    *   **AC-B04-2:** *Given* T1 gagal, *When* loop, *Then* langsung `REMEDIATE` tanpa T2.

#### B-05 — Naikkan `max_triage_fix_cycles` 2→3
*   **Priority:** P1 · **Tea Tier:** P1 · **Estimate:** S · **Depends:** [B-02] · **Assignee:** ompimpa-prd
*   **AC:** *Given* 3× REMEDIATE, *When* `retries 3`, *Then* `BLOCK Circuit Breaker tripped`.

### Epic C — Knowledge & DX

#### C-01 — Graphify Blast-Radius via `mix xref` + LSP
*   **Priority:** P0 · **Tea Tier:** P0 · **Estimate:** M · **Depends:** [A-02] · **Assignee:** ompimpa-ecto
*   **AC:** Ubah `accounts.ex` → `_ompimpa/graph.json` list `live/*` terdampak `<2s` di 500 file. Kill: `>2s → fallback lsp lazy`.

#### C-02 — Deferred-Work + `ompimpa sweep`
*   **Priority:** P1 · **Tea Tier:** P2 · **Estimate:** M · **Depends:** [B-02] · **Assignee:** ompimpa-prd
*   **AC:** `deferred.md` 2 P2 → `sweep` promote `ready-for-dev`.

#### C-03 — Pitfalls Auto-Append
*   **Priority:** P1 · **Tea Tier:** P2 · **Estimate:** S · **Depends:** [B-02] · **Assignee:** ompimpa-test
*   **AC:** REMEDIATE sukses → `rules/pitfalls.md` + `SOL-XXX`.

#### C-04 — Setup Wizard Greenfield/Brownfield
*   **Priority:** P2 · **Tea Tier:** P2 · **Estimate:** M · **Depends:** [A-02] · **Assignee:** ompimpa-prd
*   **AC:** `mix.exs` ada → `CLAUDE.md` Brownfield `scope=delta`.

#### C-05 — Docs Generator Deterministik 4 Kuadran
*   **Priority:** P2 · **Tea Tier:** P2 · **Estimate:** M · **Depends:** [A-02] · **Assignee:** ompimpa-doc
*   **AC:** `docs/` 4 kuadran ter-generate 0 placeholder.

#### C-06 — Inspeksi 4-Pilar Scorecard 0–100
*   **Priority:** P2 · **Tea Tier:** P2 · **Estimate:** M · **Depends:** [A-03] · **Assignee:** ompimpa-test
*   **AC:** `_ompimpa/inspeksi/report.md` 4 pilar skor.

## 8. Dependencies & Execution Order (DAG) — [ADDENDUM 2026-09-02: Epic Orchestrator, Review per Story]

> **Koreksi PRD-001 §8:** `Dev per epic orchestrator, Review tetap per story isolated 10` (sinkron `bmad-loop run --epic` + ADR-001 Addendum).
> Epic = batch orchestrator (loop sekuensial `for story in epic sorted DAG`), Story = gate mutu `PASS 100/100` isolated. Dilarang review monolit per epic (INV-07).

```
A-01 (no deps) → review 10 isolated → PASS → done
├── A-02 (deps A-01) → review 10 → PASS → done ──┬── B-04 (tiered T1/T2/T3)
│                                                  ├── C-01 (graphify)
│                                                  ├── C-04 (wizard)
│                                                  └── C-05 (docs)
└── A-03 (deps A-01) → review 10 → PASS → done ──┬── B-01 (7→10 isolated) → B-02 (dedup) ──┬── B-05 (cycles 3)
                                                  │                                        ├── C-02 (deferred)
                                                  │                                        └── C-03 (pitfalls)
                                                  └── B-03 (split lens 7→10)              └── C-06 (inspeksi)
```

**Perintah Rekomendasi (review tetap per story 10 isolated):**
```bash
# Epic orchestrator (rekomendasi — sama dengan bmad-loop --epic):
/ompimpa:dev --epic EPIC-A --auto   # A-01→A-02→A-03 sekuensial, tiap story 10 review isolated
/ompimpa:dev --epic EPIC-B --auto   # B-01→B-05
/ompimpa:dev --epic EPIC-C --auto   # C-01→C-06 (P2 iteratif)
# Manual per story (debug):
/ompimpa:dev --story A-01
# Verify epic (Tier3 background):
/ompimpa:verify --epic EPIC-A
```

## 7. Kill Criteria & Circuit Breakers

*   DAG check >500ms → cache `_ompimpa/.cache/dag.json` (A-02).
*   26 file inject >8k token → lazy-load per-law (A-01).
*   Floor 100 → fallback `scoring_version=v1` (A-03).
*   7 task >12s → fallback 4 reviewers (B-01).
*   Dedup salah merge → fix `category+ruleId` (B-02).
*   T1+T2 >12s → skip T2 stale (B-04).
*   Graphify >2s → fallback LSP lazy (C-01).

**Global Circuit Breaker:** `retries >=3` → `BLOCK` escalate ke manusia (`hooks/ompimpa-guard.ts:398`).

---

## 8. Dependencies & Execution Order (DAG)

```
A-01 (no deps)
├── A-02 ──┬── B-04
│          ├── C-01
│          ├── C-04
│          └── C-05
└── A-03 ──┬── B-01 ──┬── B-02 ──┬── B-05
           │          │          ├── C-02
           │          │          └── C-03
           │          └── B-03
           └── C-06
```

**Gelombang 1 (1–2 hari):** A-01, A-02, C-01.  
**Gelombang 2 (1 minggu):** A-03, B-01, B-02, B-04.  
**Gelombang 3 (iteratif):** B-03, B-05, C-02, C-03, C-04, C-05, C-06.

**Status saat ini:** `backlog:14` (paused per instruksi user — epic/story only).

---

## 9. Acceptance Threshold

*   `bun test` hijau: `ttsr_rules`, `prewalk_and_reviewer` (update floor 100), `triage` (21 tests port), `stories_dag`, `graphify`, `inspeksi`.
*   `ompimpa doctor` hijau, `templates/ompimpa.toml` `scoring_version=v2` valid.
*   `mix xref graph` <2s, `mix compile --warnings-as-errors` 0 warning.

---

*Disusun: H. Agus Salim (ompimpa-prd) — BMM Product Governance. Rujukan kanonik tetap `_ompimpa/stories.yaml`.*
