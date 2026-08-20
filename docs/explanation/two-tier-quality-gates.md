# Penjelasan: Arsitektur Gerbang Mutu Tiga Tingkat (Three-Tier Quality Gates) & Closed-Loop Remediation

Dokumen penjelasan ini membedah alasan teknis mengapa OMP-IMPA menerapkan pertahanan mutu berlapis tiga tingkat (**Tier 0: TTSR Real-Time Stream Guard**, **Tier 1: Semantic & Security Review**, dan **Tier 2: Strict Compiler & Test Gate**), serta bagaimana siklus tertutup (*Closed-Loop Remediation*) menjamin integritas kode sebelum di-commit.

## 1. Masalah Review Konvensional (The Monolithic Review Bottleneck)

Pada alur pengembangan konvensional, review hanya dilakukan di akhir saat seluruh fitur selesai dan Pull Request dibuka:
- **Dampak Negatif:** Jika developer (atau AI) melakukan kesalahan fundamental pada Story 1 (misalnya: memakai tipe `:float` pada skema database atau lupa otorisasi event), kesalahan tersebut akan menular ke Story 2, 3, dan seterusnya.
- **Biaya Perbaikan Tinggi:** Memperbaiki 10 story yang saling bergantung di akhir jauh lebih mahal dan rawan menimbulkan regresi.

---

## 2. Solusi OMP-IMPA: Three-Tier Quality Gates Architecture

```
[LLM STREAMING KODING] ──► [TIER 0: TTSR STREAM GUARD] ──(Pola Salah?)──► [ABORT & ROLLBACK INSTAN]
                                   │ (Lolos/Clean)
                                   ▼
                             [TES HIJAU]
                                   │
                                   ▼
                     [TIER 1: MACRO-REVIEW 4-JALUR]
                     (Rasuna Said Semantik + Azizchan Keamanan + Imam Bonjol QA)
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
             [ADA TEMUAN P0/P1]          [NOL TEMUAN / CLEAN]
                     │                           │
             [TRIAGE & PRIORITISASI]             │
                     │                           │
             [REMEDIASI KODING SPESIALIS]        │
                     │                           │
             [RE-REVIEW VERIFIKASI STORY]        │
                     │                           │
                     └─────────────┬─────────────┘
                                   │
                                   ▼
                     [TIER 2: STRICT COMPILER & TEST GATE]
                     (mix compile --warnings-as-errors + mix test)
                                   │
                                   ▼
                     [GIT COMMIT & STATUS DONE]
```

### Peran Masing-Masing Tier:

1. **Tier 0 — TTSR Real-Time Stream Guard (0-Token Waste)**:
   - Bekerja secara *in-stream* pada buffer streaming tool `edit`/`write`.
   - Menginterupsi dan me-rollback kesalahan sintaksis/primitif (misal: tipe `:float` pada uang, `String.to_atom`, XSS `raw/1`) sebelum kode tersimpan ke disk.

2. **Tier 1 — Semantic & Security Review (Hj. Rasuna Said & Bagindo Azizchan)**:
   - Menilai invariant tingkat tinggi, relasi multi-berkas, integritas pohon supervisi BEAM (`application.ex`), otorisasi socket dinamis, dan idempotensi background jobs Oban.

3. **Tier 2 — Strict Compiler & Test Gate**:
   - Menegakkan `mix compile --warnings-as-errors`, format kode resmi, dan 100% tes ATDD/ExUnit berstatus hijau.

### Keuntungan Siklus Tertutup:
1. **Zero Blocker Debt**: Tidak ada story yang dinyatakan selesai jika masih menyisakan pelanggaran Hukum Besi atau celah keamanan.
2. **Determinisme Re-Review**: Setiap perbaikan kode wajib melalui verifikasi ulang untuk menjamin tidak ada regresi baru yang muncul.
3. **Penyaringan Cerdas (Triage)**: Saran minor (P2) dialihkan ke backlog tech debt sehingga tidak menghambat kecepatan penyelesaian fungsionalitas inti.
