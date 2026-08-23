---
description: Memulai musyawarah meja bundar (3-Ronde Deliberasi: Blind Analysis, Cross-Debat, Verdict) bersama Dewan Tokoh OMP-IMPA
---

# Command: /balairung

Membuka sidang permusyawaratan **Balairung Sari** untuk mengambil keputusan arsitektur, strategi produk, resolusi trade-off, atau analisis risiko kritis menggunakan protokol deliberasi multi-persona 3-ronde.

## Penggunaan

```bash
# 1. Mode Default: Auto-Pick pintar anggota dewan berdasarkan topik
/balairung [topik / pertanyaan keputusan strategis]

# 2. Mode Full Council: Seluruh anggota dewan hadir (10-14 persona)
/balairung --full "Arsitektur multi-tenant: Database per tenant vs Schema Scoped vs Ash Multitenancy"

# 3. Mode Triad Tematik (3 Persona Spesialis)
/balairung --triad arsitektur "Pilih Redis PubSub atau Phoenix.PubSub native BEAM?"
/balairung --triad produk "Rilis MVP tanpa fitur ekspor PDF atau tunda rilis?"
/balairung --triad risiko "Rilis fitur pembayaran instan tanpa KYC penuh"
/balairung --triad database "Event Sourcing vs CRUD Relasional untuk saldo dompet"
/balairung --triad realtime "Polling vs WebSockets LiveView untuk dashboard 100k pengguna"

# 4. Mode Custom Members / Duo Dialektika
/balairung --members tan-malaka,rasuna-said,azizchan "Penyimpanan token JWT di localStorage vs Cookie HTTP-Only"
/balairung --duo --members rohana-kudus,tan-malaka "Optimistic UI rendering vs Server Authority Confirmation"
```

## Protokol 3 Ronde Wajib (*The 3-Round Protocol*)

Sidang Balairung dipandu oleh protokol ketat yang menjamin kedalaman nalar dan mencegah *groupthink*:

```
[PERTANYAAN / DILEMA STRATEGIS]
               │
               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🗳️ RONDE 1: PANDANGAN INDEPENDEN (Blind Opening Analysis)              │
│ • Setiap persona menganalisis masalah secara mandiri (terisolasi).     │
│ • Agen DILARANG membaca pandangan persona lain (anti-sycophancy).      │
│ • Wajib melabeli argumen: [FACT], [INFERENCE], [ASSUMPTION], [UNKNOWN].│
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ ⚔️ RONDE 2: DEBAT SILANG & DIALEKTIKA (Adversarial Cross-Examination)  │
│ • Seluruh analisis Ronde 1 dibuka untuk semua persona yang hadir.      │
│ • Saling menguji asumsi, mencari kelemahan argumen rekan, dan bedah   │
│   skenario kegagalan ekstrem (Worst-Case Analysis).                    │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 📜 RONDE 3: SINTESIS MUFAKAT & VERDICT (Consensus & Preserved Dissent) │
│ • Merumuskan Rekomendasi Inti / Mufakat Akhir.                         │
│ • Mencatat Dissenting Opinions (suara minoritas yang tidak setuju).   │
│ • Menetapkan Kill Criteria (kondisi di mana keputusan harus batal).   │
│ • Menentukan 1 Langkah Konkret Selanjutnya (Next Action).              │
└────────────────────────────────────────────────────────────────────────┘
```

## Auto-Pick Heuristics (Pemilihan Anggota Otomatis)

Jika Anda tidak menyertakan flag `--triad` atau `--members`, sistem otomatis memilih 3–4 persona paling kompeten:
* **Topik Keamanan & Perimeter**: `ompimpa-security` + `ompimpa-ironlaw` + `ompimpa-ui`.
* **Topik Arsitektur & BEAM**: `ompimpa-triz` + `ompimpa-otp` + `ompimpa-ecto` / `ash`.
* **Topik Arah Produk & UX**: `ompimpa-ideate` + `ompimpa-prd` + `ompimpa-ui` + `ompimpa-test`.
* **Topik Background Jobs & Skalabilitas**: `ompimpa-oban` + `ompimpa-otp` + `ompimpa-triz`.

## Luaran (*Deliverables*)

Hasil mufakat disimpan secara persisten di:
📁 **`_ompimpa/balairung/BALAIRUNG-[YYYYMMDD-HHMM]-[slug].md`**

> 💡 **Prinsip Referensi Bebas**: Berkas ini tidak memicu koding langsung, tetapi menjadi dokumen rujukan resmi yang dapat dikutip kapan saja oleh `/ompimpa:prd`, `/ompimpa:adr`, `/ompimpa:ui`, atau `/ompimpa:dev`.
