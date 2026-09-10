---
id: SOL-001
topic: float-decimal-il-01
tags: [ironlaw, float, decimal, IL-01, TEA-08]
stack: [elixir, ecto]
date: 2026-09-02
---

# Solusi SOL-001: Float → Decimal untuk Field Uang (IL-01)

## Gejala & Masalah
Field Ecto `field :balance, :float` atau `field :amount, :float` lolos ke schema, menyebabkan presisi hilang pada transaksi uang. TTSR `01-no-float-money.md` mendeteksi sebagai Critical (-30) tapi developer mengulang pola yang sama di file lain.

## Akar Penyebab (Root Cause)
- Contoh generator Phoenix default menggunakan `:float` untuk numerik.
- Regex TTSR awal `:\w+,\s*:float` tidak strict untuk `field :*`.
- Tidak ada pitfalls memory, sehingga remediasi tidak terindeks.

## Pola Solusi yang Terbukti (Proven Fix)

```elixir
# sebelum
field :amount, :float

# sesudah (PASS 100/100)
field :amount, :decimal
# migration: add :amount, :decimal, precision: 12, scale: 2
# changeset: cast(attrs, [:amount]) |> validate_required([:amount]) |> validate_number(:amount, greater_than: 0)
```

Remediation TTSR: `gunakan :decimal atau integer cents` di line tepat.

## Invariant Pencegahan Regresi
1. `grep -R "field :.*:float" lib/` harus 0 sebelum commit (prewalk).
2. `loadPrewalkRules()` TTSR `01-no-float-money` abort dengan remediation `gunakan :decimal atau integer cents`.
3. Dedup `file:line:ruleId` 3 reviewer → 1 entitas, penalty 1× -30 (B-02).
4. Pitfalls auto-append: setiap REMEDIATE IL-01 → `rules/pitfalls.md` + SOL ter-index, di-inject ke prompt `ompimpa-ironlaw` berikutnya.
