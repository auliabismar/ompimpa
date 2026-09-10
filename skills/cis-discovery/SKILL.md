---
name: cis-discovery
description: Metodologi Creative Intelligence Suite (CIS) untuk sesi curah pendapat SCAMPER, pemetaan empati, dan resolusi TRIZ.
---

# Skill: CIS Discovery & Ideation

## Teknik Utama
1. **SCAMPER**: Lensa inovasi untuk *Substitute*, *Combine*, *Adapt*, *Modify*, *Put to other use*, *Eliminate*, dan *Reverse*.
2. **Reverse Brainstorming**: Merumuskan skenario kegagalan ekstrem untuk menghasilkan invariant sistem pertahanan.
3. **Empathy Mapping**: Memetakan kuadran *Says, Thinks, Does, Feels* untuk menemukan titik friksi emosional pengguna.
4. **TRIZ Contradiction Matrix**: Melarutkan trade-off teknis menggunakan prinsip pemisahan dalam Waktu, Ruang, dan Kondisi.

---

## Sequential-Thinking (Wajib Trigger-Based)
Pemicu WAJIB (≥1 terpenuhi):
1. Solusi multi-langkah ≥3 langkah.
2. Scope awal belum jelas / arah bisa berubah.
3. Ada trade-off/kontradiksi atau ≥2 opsi nyata.
4. Butuh hipotesis + verifikasi / revisi arah.
5. Perlu menyaring info irrelevan lintas sumber.

Cara pakai:
WAJIB memakai tool sequential-thinking bila ≥1 pemicu di atas terpenuhi. Tulis JSON ke xd://mcp__sequential_thinking_sequentialthinking (thought, nextThoughtNeeded, thoughtNumber, totalThoughts; revisi via isRevision/revisesThought, cabang via branchFromThought/branchId). Hasilkan satu hipotesis, verifikasi terhadap langkah berpikir, ulangi sampai puas; nextThoughtNeeded:false hanya saat jawaban final tercapai. Fokus: urutkan SCAMPER → reverse → empathy map → TRIZ matrix; cabang tiap lensa lalu saring ke HMW.
