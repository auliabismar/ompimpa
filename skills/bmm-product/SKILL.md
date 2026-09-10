---
name: bmm-product
description: Panduan penyusunan Master PRD, Epics & Stories Breakdown, dan Architecture Decision Records (ADRs) berstandar MADR.
---

# Skill: BMM Product Governance & ADR

## Struktur Dokumen Inti
1. **Master PRD**:
   - Scope vs Non-Goals.
   - Functional Requirements (FR) & Non-Functional Requirements (NFR).
   - Epics Spine dengan Acceptance Criteria berformat Gherkin (`Given / When / Then`).
2. **Architecture Decision Records (MADR 3.0+)**:
   - Context and Problem Statement.
   - Decision Drivers.
   - Considered Options (minimal 2-3 pilihan).
   - Decision Outcome & Justification.
   - Consequences & Enforced Invariants.

## B-03 Split Spec Lens 4 BMAD (Adversarial/Gap/Structural/Completeness)
- Template ADR/PRD kini mendukung 4 lens spec review vs monolit 1 Agus Salim:
  - `bmad_adversarial`: edge/crash/race (Tan Malaka)
  - `bmad_gap_verifier`: AC traceability 100% — miss 1 AC → High (TEA-01)
  - `bmad_structural`: Clean Spine, boundary, coupling
  - `bmad_completeness`: docs/PRD/ADR sync (upstream BMAD 4)
- Saat `quality.review.bmad_lens_count=3|4`, `buildReviewPanel` hasilkan 9/10 panel (3/4 spec +6 tech) bukan 7.
- Backward compat: tanpa flag tetap 1 spec.

---

## Sequential-Thinking (Wajib Trigger-Based)
Pemicu WAJIB (≥1 terpenuhi):
1. Solusi multi-langkah ≥3 langkah.
2. Scope awal belum jelas / arah bisa berubah.
3. Ada trade-off/kontradiksi atau ≥2 opsi nyata.
4. Butuh hipotesis + verifikasi / revisi arah.
5. Perlu menyaring info irrelevan lintas sumber.

Cara pakai:
WAJIB memakai tool sequential-thinking bila ≥1 pemicu di atas terpenuhi. Tulis JSON ke xd://mcp__sequential_thinking_sequentialthinking (thought, nextThoughtNeeded, thoughtNumber, totalThoughts; revisi via isRevision/revisesThought, cabang via branchFromThought/branchId). Hasilkan satu hipotesis, verifikasi terhadap langkah berpikir, ulangi sampai puas; nextThoughtNeeded:false hanya saat jawaban final tercapai. Fokus: susun PRD spine + MADR (konteks → opsi ≥2 → keputusan → konsekuensi/invariant); verifikasi tiap opsi ke driver.
