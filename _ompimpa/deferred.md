# Deferred Work — Antrian P2 / TechDebt (OMP Native)

> **Sumber:** Triage P2 nits yang tidak diblok P0, di-sweep via `ompimpa sweep` ke `ready-for-dev`.
> Format kompatibel dengan `bmad-loop sweep` agyimpa (port TS native, worktree `~/.omp/wt/`).

## Queue — Open P2 (2 entries)

| ID | Title | Priority | Status | Source Story | Intent |
|---|---|---|---|---|---|
| DW-01 | Refactor Accounts context boundary khusus LiveView | P2 | open | C-01 | Perkecil coupling `MyApp.Accounts` → `MyAppWeb.Live` via blast-radius graph |
| DW-02 | Tambah pitfalls entry untuk float→decimal | P2 | open | B-02 | Dokumentasikan pola IL-01 remediasi ke `rules/pitfalls.md` |

## Deferred Entries (YAML-like)

- id: DW-01
  title: "Refactor Accounts context boundary khusus LiveView"
  priority: P2
  status: open
  source: C-01
  intent: "Gunakan graphify blast-radius untuk pecah Accounts boundary, kurangi xref coupling."

- id: DW-02
  title: "Tambah pitfalls entry untuk float→decimal"
  priority: P2
  status: open
  source: B-02
  intent: "Auto-append rules/pitfalls.md saat REMEDIATE IL-01 sukses, compound memory SOL-*."

## Resolved / Promoted

_(kosong — akan diisi sweep)_

## Instruksi Sweep

```bash
ompimpa sweep                 # promosi open → ready-for-dev di feature-status.yaml
ompimpa sweep --dry-run       # preview tanpa ubah status
```

- Sweep membaca `deferred.md` open P2, validasi DAG, lalu promote ke `feature-status.yaml` status `ready-for-dev` (worktree isolated jika `use_git_worktrees=true`).
- Port agyimpa `sweep.py` + `deferredwork.md` sweep OMP Native.
