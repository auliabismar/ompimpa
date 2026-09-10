---
name: tea-testing
description: Metodologi Test Architecture Enterprise (TEA) - Matriks Risiko P1-P4, Red-Phase ATDD, In-Band Mutation Guard, dan Audit Kualitas Tes Scorecard 100/100.
---

# Skill: Test Architecture & ATDD (TEA)

## Matriks Prioritas Pengujian (P1–P4)
- **P1 (Kritis / Keuangan / Keamanan)**: Kalkulasi uang, otorisasi socket, dan multi-tenant scoping. Cakupan 100%.
- **P2 (Alur Kerja Inti & LiveView)**: Submit form, navigasi modal, stream rendering. In-process `LiveViewTest`.
- **P3 (Edge Cases & Pemulihan)**: Reconnection recovery, concurrency conflict, DB constraint violations.
- **P4 (UI & Visual)**: Styling visual, CSS classes, dan client-side transitions.

## 5 Dimensi Scorecard Kualitas Tes (Batas Lolos >= 90)
1. **Determinisme & Kecepatan**: Eksekusi in-process cepat, bebas sleep sembarangan.
2. **Isolasi Sandbox**: Checkout mode SQL Sandbox yang bersih dan deterministik.
3. **Ketegasan Asersi**: Pattern matching yang presisi terhadap state aktual.
4. **Pesan Kegagalan Jelas**: Informasi kegagalan yang langsung memandu perbaikan.
5. **Cakupan Jalur Negatif**: Pengujian eksplisit untuk penolakan akses dan input invalid.

## In-Band Mutation Guard & AC Traceability (TEA-01)

### 1. Ketertelusuran 100% Acceptance Criteria (Traceability)
- Setiap Kriteria Penerimaan Gherkin pada spesifikasi mikro `_ompimpa/specs/SPEC-[ID].md` wajib dipetakan langsung ke unit/integration test nyata dengan ID kriteria tertera jelas (`AC-*`).
- **Aturan Penalti:** Jika ditemukan kriteria penerimaan yang tidak memiliki penegasan tes otomatis (*missing AC*), triage mencatat temuan **High Finding (P1, -15 poin)** pada aturan `TEA-01`.

### 2. Deteksi Asersi Bodong & Formalitas (Assertion Mutation Guard)
Untuk mencegah *false greens* (tes hijau semu yang tidak menguji logika bisnis), audit in-band secara ketat menolak:
- **Asersi Tautologi (TS/JS):** `expect(true).toBe(true)`, `expect(true).toBeTruthy()`, `expect(false).toBe(false)`, `expect(false).toBeFalsy()`.
- **Asersi Tautologi (Elixir ExUnit):** `assert true`, `assert true == true`, `assert :ok == :ok`, `assert 1 == 1`.
- **Kasus Tes Kosong (*Empty Test Cases*):** Blok `it(...)` atau `test "..." do ... end` tanpa adanya pemanggilan penegasan (`expect(...)` atau `assert/refute`).
- **Aturan Penalti:** Setiap temuan asersi bodong diklasifikasikan sebagai **High Finding (-15 poin)** dan memblokir kelulusan scorecard 100/100.

### 3. Standar Remediasi Kualitas Asersi
- Gantikan asersi formalitas dengan validasi state mutasi konkret, nilai kembalian fungsi, atau verifikasi pesan PubSub/Oban job payload.
- Gunakan pattern matching ketat pada Elixir (`{:ok, %{status: :active}} = result`).
- Pastikan failure message informatif dan langsung memandu perbaikan akar masalah (*root cause*).

### 4. Ambang Kelulusan Scorecard (v2 100/100)
- Seluruh story wajib mencapai skor **100/100 PASS** tanpa adanya blocker (P0), warning (P1), maupun nits (P2) yang belum terselesaikan.

---

## Sequential-Thinking (Wajib Trigger-Based)
Pemicu WAJIB (≥1 terpenuhi):
1. Solusi multi-langkah ≥3 langkah.
2. Scope awal belum jelas / arah bisa berubah.
3. Ada trade-off/kontradiksi atau ≥2 opsi nyata.
4. Butuh hipotesis + verifikasi / revisi arah.
5. Perlu menyaring info irrelevan lintas sumber.

Cara pakai:
WAJIB memakai tool sequential-thinking bila ≥1 pemicu di atas terpenuhi. Tulis JSON ke xd://mcp__sequential_thinking_sequentialthinking (thought, nextThoughtNeeded, thoughtNumber, totalThoughts; revisi via isRevision/revisesThought, cabang via branchFromThought/branchId). Hasilkan satu hipotesis, verifikasi terhadap langkah berpikir, ulangi sampai puas; nextThoughtNeeded:false hanya saat jawaban final tercapai. Fokus: matriks P1-P4 → red-phase → TEA-01 traceability → mutation guard; tolak klaim lolos bila 1 AC tak terpetakan.
