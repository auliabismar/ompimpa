# ADR-001 Addendum: Dev per Epic Orchestrator, Review Tetap per Story Isolated 10

> **Induk:** `ADR-001-panen-agyimpa-isolated-review-criteria-registry.md` (2026-09-02)  
> **Tanggal Addendum:** 2026-09-02  
> **Decider:** H. Agus Salim (ompimpa-prd) — Adendum tanpa Balairung full (instruksi user A)  
> **Rujukan:** `BALAIRUNG-20260902-panen-agyimpa-review-sync.md`, `PRD-001 §8`, `_ompimpa/stories.yaml` (14 stories, epic EPIC-A/B/C), `_ompimpa/criteria_registry_35.json` v2, `agyimpa` `bmad-loop run --epic` + `loop_runner.py` per story  
> **Status:** Accepted — Mengklarifikasi diksi PRD-001 §8

---

## 1. Konteks

PRD-001 §8 tulis `per story` seolah `ompimpa:dev` harus manual `A-01 → A-02 → A-03` satu-satu. User klarifikasi: **di `bmad-loop`, `dev` dijalankan per `epic` (`run --epic 3`) tetapi `review` tetap per `story` isolated 10** — inilah yang diinginkan, bukan dev monolit per epic (1 diff 20 file → 1 review).

## 2. Keputusan Adendum

**Rekomendasi resmi:** **`dev` per `epic` orchestrator, `review` per `story` isolated 10.**

*   **Epic = orchestrator batch:** `ompimpa dev --epic EPIC-A --auto` (atau `bmad-loop run --epic 3`) → loop sekuensial `for story in epic sorted DAG: dev → 7→10 isolated review → triage dedup 100 → PASS → next story`. Epic tidak punya diff/review sendiri.
*   **Story = gate mutu:** Tiap story wajib `PASS 100/100` (35-Row `-30/-15/-5/-2`, dedup `file:line:ruleId`, `allow_p2_nits=false`) sebelum story berikutnya di epic sama jalan. `depends_on` tetap enforce DAG.
*   **Manual per story tetap boleh:** `ompimpa dev --story A-01` untuk debug 1 story, tetap sama gate per story.

## 3. Rasional

*   **Presisi:** Diff `3–5 file` per story → dedup & scoring tepat; diff epic `20 file` → skor semu. [FACT] `triage_collector.py` dedup per `file:line:ruleId` keep `Critical` — hanya valid per story.
*   **Circuit breaker:** `max_triage_fix_cycles=3` & `max_dev_retries=3` per story — epic batch tidak bisa escalate tepat jika monolit.
*   **Latensi:** `T1+T2 <12s` per story — epic batch tetap <1 menit untuk 3 story, feedback cepat.
*   **Kompatibel `bmad-loop`:** `execution_engine.py` + `loop_runner.py` memang per `StorySpec`, `sprint-status.yaml` per story, epic cuma grouping `stories.yaml: epic: EPIC-A`.

## 4. Perintah Rekomendasi

```bash
# Rekomendasi (epic orchestrator, review per story 10 isolated):
/ompimpa:dev --epic EPIC-A --auto   # A-01→A-02→A-03 sekuensial, tiap 7→10 review isolated
/ompimpa:dev --epic EPIC-B --auto   # B-01→B-05
/ompimpa:dev --epic EPIC-C --auto   # C-01→C-06 (P2 iteratif)

# Alternatif manual per story (debug):
/ompimpa:dev --story A-01
/ompimpa:dev --story B-01

# Verify epic (Tier3 background, bukan gate per story):
/ompimpa:verify --epic EPIC-A   # = Tier3 full+credo+sobelow setelah 3 story PASS
```

`--epic` filter `stories.yaml: epic == EPIC-A` + `depends_on` topo-sort. `--auto` pakai `session_stop` hook `checkDevLoopContinuation` yang sudah cek `hasPendingStory` per story.

## 5. Dampak

*   `PRD-001 §8` dikoreksi: `Dev per epic orchestrator, Review per story`.
*   Tambah story **B-06: `--epic` flag** di `_ompimpa/stories.yaml` (depends B-04, P1, S).
*   `templates/ompimpa.toml` tidak perlu ubah — `use_git_worktrees` + `parallel_reviewers=6` tetap.
*   `feature-status.yaml` tetap per story `backlog` — epic `done` = semua story di epic `done`.

## 6. Invariant Tambahan

*   **INV-07 Epic Orchestrator:** Dilarang `review` monolit per epic — tiap story wajib `review` isolated 10 & `PASS 100` sebelum next story di epic sama.

---

*Adendum tanpa Balairung full — sinkron dengan `bmad-loop --epic` behavior yang sudah ada.*
