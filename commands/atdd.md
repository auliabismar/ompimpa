---
description: Merancang matriks risiko P1-P4 dan scaffolding tes merah Red-Phase ATDD bersama Tuanku Imam Bonjol
---

# Command: /atdd

Jalankan subagent `ompimpa-test` (Tuanku Imam Bonjol) untuk menganalisis Kriteria Penerimaan dari SPEC story dan menghasilkan berkas tes penerimaan ExUnit/LiveViewTest yang sengaja **MERAH (failing)** sebelum implementasi dimulai.

> 🛡️ **Gerbang deterministik (`ompimpa atdd <ID>`):** INV-09 (SPEC wajib ada) + seluruh berkas tes target §6 SPEC wajib sudah di-scaffold. Lolos → status maju ke `ready-for-dev` (milestone atdd-red). Bukti MERAH (tes gagal by design) adalah tanggung jawab agen ATDD di sesi harness dan diverifikasi ulang oleh lensa gap_verifier/adversarial di `/review` — false green = REMEDIATE.

---

## Pembagian Kerja (jujur)

- **CLI (`ompimpa atdd [--auto]`)**: menjamin file test ada (scaffold stub
  `flunk` per AC bila hilang) + memajukan status ke `ready-for-dev`. Stub
  adalah rancangan merah, bukan bukti.
- **Sesi DEV**: wajib mengganti stub menjadi asersi substantif dan membuktikan
  merah via scoped test sebelum menulis kode. Sisa `flunk()` di gate final =
  temuan P1 (`auditResidualFlunk`).
