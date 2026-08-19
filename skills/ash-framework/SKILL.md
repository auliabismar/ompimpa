---
name: ash-framework
description: Panduan arsitektur Ash Framework 3.0+ (Resources, Actions, Policies, Calculations, Aggregates, and Query Scoping).
---

# Skill: Ash Framework Mastery

## Fondasi & Aturan Kunci
1. **Declarative First**: Definisikan semua validasi dan mutasi data di blok `validate` dan `change` di dalam Action Resource, bukan dengan procedural context Elixir.
2. **Fail-Closed Policies (Hukum Besi #23)**:
   - Kebijakan otorisasi wajib menolak akses tanpa izin secara default (*default deny*).
   - Gunakan `Ash.Policy.Authorizer` pada setiap resource yang menyimpan data pengguna atau tenant.
3. **Pencegahan N+1 & Optimasi Query**:
   - Manfaatkan `Ash.Query.load/2` untuk memuat relasi dan kalkulasi di awal.
   - Gunakan agregat deklaratif (`count`, `sum`, `first`) di tingkat Resource.
4. **Higienitas Migrasi**:
   - Selalu generate migrasi database menggunakan `mix ash.codegen`.
