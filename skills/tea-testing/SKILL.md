---
name: tea-testing
description: Metodologi Test Architecture Enterprise (TEA) - Matriks Risiko P1-P4, Red-Phase ATDD, dan Audit Kualitas Tes Scorecard >= 90.
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
