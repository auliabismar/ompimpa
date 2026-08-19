# Penjelasan: Arsitektur Review Dua Tingkat & Siklus Remediasi Tertutup

Dokumen penjelasan ini membedah alasan teknis mengapa OMP-IMPA memisahkan review ke dalam **Micro-Review** dan **Macro-Review**, serta bagaimana siklus tertutup (*Closed-Loop Remediation*) menjamin integritas kode sebelum di-commit.

---

## 1. Masalah Review Konvensional (The Monolithic Review Bottleneck)

Pada alur pengembangan konvensional, review hanya dilakukan di akhir saat seluruh fitur selesai dan Pull Request dibuka:
- **Dampak Negatif:** Jika developer (atau AI) melakukan kesalahan fundamental pada Story 1 (misalnya: memakai tipe `:float` pada skema database atau lupa otorisasi event), kesalahan tersebut akan menular ke Story 2, 3, dan seterusnya.
- **Biaya Perbaikan Tinggi:** Memperbaiki 10 story yang saling bergantung di akhir jauh lebih mahal dan rawan menimbulkan regresi.

---

## 2. Solusi OMP-IMPA: Closed-Loop Review Architecture

```
[EKSEKUSI STORY] ──> [TES HIJAU] ──> [MACRO-REVIEW 4-JALUR]
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
             [ADA TEMUAN P0/P1]                                [NOL TEMUAN / CLEAN]
                     │                                                 │
             [TRIAGE & PRIORITISASI]                                   │
                     │                                                 │
             [REMEDIASI KODING SPESIALIS]                              │
                     │                                                 │
             [RE-REVIEW VERIFIKASI STORY]                              │
                     │                                                 │
                     └────────────────────────┬────────────────────────┘
                                              ▼
                                 [GIT COMMIT & STATUS DONE]
```

### Keuntungan Siklus Tertutup:
1. **Zero Blocker Debt**: Tidak ada story yang dinyatakan selesai jika masih menyisakan pelanggaran Hukum Besi atau celah keamanan.
2. **Determinisme Re-Review**: Setiap perbaikan kode wajib melalui verifikasi ulang untuk menjamin tidak ada regresi baru yang muncul.
3. **Penyaringan Cerdas (Triage)**: Saran minor (P2) dialihkan ke backlog tech debt sehingga tidak menghambat kecepatan penyelesaian fungsionalitas inti.
