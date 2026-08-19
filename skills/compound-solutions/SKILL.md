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
