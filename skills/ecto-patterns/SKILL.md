---
name: ecto-patterns
description: Panduan pola desain database Ecto (Schemas, Changesets, Constraints, Pinning, Multi-Transactions, Safe Migrations).
---

# Skill: Ecto Database Patterns

## Hukum Besi & Pola Inti
1. **Presisi Keuangan (Hukum Besi #1)**: DILARANG menggunakan `:float` untuk nilai uang, saldo, atau diskon. Gunakan `:decimal` atau integer sen.
2. **Operator Pinning (Hukum Besi #6)**: Selalu sematkan operator `^` pada variabel di ekspresi `Ecto.Query` untuk mencegah kebocoran atau interpolasi mentah.
3. **Strategi Loading Relasi (Hukum Besi #7)**: Gunakan query terpisah untuk `has_many` dan join untuk `belongs_to` guna menghindari Cartesian product.
4. **Join Eksplisit (Hukum Besi #13)**: Wajib menyertakan klausa `on:` atau `join: b in assoc(a, :b)`; dilarang cross-join implisit.
5. **Deduplikasi Sebelum cast_assoc (Hukum Besi #15)**: Lakukan deduplikasi data bersama sebelum `cast_assoc` atau `put_assoc`.
6. **Ecto.Multi**: Gunakan `Ecto.Multi` untuk mutasi transaksional multi-langkah agar rollback berjalan otomatis saat ada kegagalan.
