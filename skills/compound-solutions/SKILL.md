---
name: compound-solutions
description: Menyimpan, mengindeks, dan mencari pola solusi teruji dari insiden atau bug masa lalu di _ompimpa/solutions/.
---

# Skill: Compound Solutions & Institutional Memory

## Struktur Dokumen Solusi (`_ompimpa/solutions/SOL-[ID]-[slug].md`)
Setiap berkas solusi memiliki format baku:

```markdown
---
id: SOL-001
topic: liveview-reconnection-state-loss
tags: [liveview, pubsub, disconnect, state-recovery]
stack: [phoenix, liveview]
date: YYYY-MM-DD
---

# Solusi SOL-001: Pemulihan State Form LiveView Saat WebSocket Reconnect

## Gejala & Masalah
[Penjelasan gejala bug atau kegagalan yang terjadi]

## Akar Penyebab (Root Cause)
[Penjelasan teknis mengapa bug terjadi]

## Pola Solusi yang Terbukti (Proven Fix)
[Cuplikan kode solusi yang telah diverifikasi hijau oleh pengujian]

## Invariant Pencegahan Regresi
1. [Invariant 1]
2. [Invariant 2]
```

## Alur Pencarian Otomatis
Sebelum memulai investigasi bug baru, subagent `ompimpa-debug` memindai `_ompimpa/solutions/` untuk menemukan pola yang cocok dengan gejala saat ini.

## C-03 Pitfalls Auto-Append (Port pitfalls_manager.py 18KB)

Setiap `REMEDIATE` sukses (P0/P1) → auto-append ke `rules/pitfalls.md` + indeks `_ompimpa/solutions/SOL-*.md` via `src/triage.ts:appendPitfall()`.

- **Trigger:** `triage dedup → calculateScore REMEDIATE → commit sukses → appendPitfall(entry)` (hook di `reviewer.ts` post-commit).
- **Format pitfalls entry:** `### [YYYY-MM-DD] <ruleId> <short title> (P0/P1 REMEDIATE — <story>)` + Gejala/Akar/Solusi/File/Invariant/SOL link.
- **SOL naming:** `SOL-<timestamp>-<slug>.md` dengan frontmatter `id, topic, tags, date`.
- **Inject ke prompt:** `compound-solutions` skill di-load otomatis oleh `ompimpa-debug` dan `ompimpa-ironlaw` sebelum audit, agar pola teruji tidak diulang.
- **Contoh:** `IL-01 float→decimal` — `field :balance, :float` → `field :balance, :decimal`, remediation `gunakan :decimal atau integer cents` di line tepat, dedup 3→1 (-30).
- **Rotasi:** Jika `pitfalls.md >500 baris` → arsip ke `_ompimpa/solutions/archive/`.
