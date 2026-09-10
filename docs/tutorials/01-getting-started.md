# Tutorial 01 — Getting Started dengan OMP-IMPA

> **Deterministik:** Digenerate otomatis dari `stories.yaml` (22 stories, EPIC-A, EPIC-B, EPIC-C, EPIC-D, EPIC-E) + `graph.json` (10 nodes) via `src/dokumentasi.ts` (port agyimpa dokumentasi_generator.py).

## Tujuan

Memulai proyek OMP-IMPA dalam 15 menit: instalasi plugin, inisialisasi Greenfield/Brownfield, menjalankan loop `ompimpa dev` per epic, dan verifikasi tiered T1/T2/T3.

## Prasyarat

- Bun 1.1+, Node 20+, Git
- (Opsional) Elixir 1.15+ & Phoenix 1.7+ untuk `mix xref graph` dan `mix compile --warnings-as-errors`
- OMP harness (`om` CLI)

## Langkah 1 — Install Plugin

```bash
omp plugin install github:auliabismar/ompimpa
# atau via marketplace
omp plugin marketplace add auliabismar/ompimpa && omp plugin install ompimpa@ompimpa
```

## Langkah 2 — Init Greenfield vs Brownfield (C-04)

```bash
# Greenfield (tanpa mix.exs) → scope=full
ompimpa init

# Brownfield (mix.exs ada & lib/ tidak kosong) → scope=delta
# Deteksi otomatis: mix.exs + lib/ → CLAUDE.md Brownfield scope=delta
ompimpa init --force
cat CLAUDE.md | grep "scope="
```

Deteksi `use_ash_framework` / `use_oban` dari `mix.exs` otomatis.

## Langkah 3 — Jalankan Epic Loop (A-01..E-03)

```EPIC-A → EPIC-B → EPIC-C → EPIC-D → EPIC-E — total 22 stories DAG
```bash
ompimpa dev --epic EPIC-A --auto   # A-01→A-03 sekuensial, tiap story 10 review isolated
ompimpa dev --epic EPIC-B --auto   # B-01→B-06 (Isolated Review & Triage)
ompimpa dev --epic EPIC-C --auto   # C-01→C-06 (Knowledge & DX)
ompimpa dev --epic EPIC-D --auto   # D-01→D-04 (Modular Commands & Outer Loop)
ompimpa dev --epic EPIC-E --auto   # E-01→E-03 (Enterprise Quality & Master Inspect)
```

Tiap story: `dispatchIsolatedReview(10) → triage dedup file:line:ruleId → scoring 100/100 → commit`.
## Langkah 4 — Graphify Blast-Radius (C-01)

```bash
ompimpa graphify
cat _ompimpa/graph.json | jq '.blast_radius_example'
# lib/accounts.ex → lib/*_web/live/* terdampak <2s di 500 file
ompimpa graphify --blast lib/accounts.ex
```

## Langkah 5 — Sweep Deferred P2 (C-02)

```bash
cat _ompimpa/deferred.md   # 2 open P2
ompimpa sweep --dry-run
ompimpa sweep              # promote ready-for-dev
```

## Langkah 6 — Verify Tiered (B-04)

```bash
ompimpa verify --tier1   # <2s compile --warnings-as-errors + format
ompimpa verify --tier2   # <10s test --stale + reviewers + triage
ompimpa verify --tier3   # background: test + credo --strict + sobelow --strict --format json
ompimpa verify           # default T1+T2 (<12s) blocking, T3 background
ompimpa inspect           # Master diagnostic out-of-band 4-pilar (Batas, Perf, Keamanan, Docs)
```

## Next

- Lanjut [How-To: Run Autonomous Dev Loop](../how-to/run-autonomous-dev-loop.md)
- Lihat [Reference: 26 Iron Laws](../reference/26-iron-laws.md) dan [Configuration TOML](../reference/configuration-toml.md)

---
*Generated: 2026-09-08T10:25:24.037Z — stories=22, adr=3, graphNodes=10, epics=EPIC-A,EPIC-B,EPIC-C,EPIC-D,EPIC-E*
