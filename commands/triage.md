---
description: Menjalankan deduplikasi hash file:line:ruleId, kalkulasi scorecard 100/100 deterministik, dan perumusan Remediation Plan dari hasil review terisolasi
---

# Command: /ompimpa:triage

Mengeksekusi proses konsolidasi, deduplikasi temuan, evaluasi scorecard mutu mutlak 100/100, dan perumusan rencana perbaikan (*Remediation Plan*) berdasarkan berkas review independen di `_ompimpa/review/<storyId>-*.json`.

Ditenagai oleh modul TypeScript deterministik **`src/triage.ts`** (0 biaya token model AI, kecepatan eksekusi sub-detik, dan 100% reproducible).

> 🛡️ **Invarian INV-08 (Pipeline Modularity):**  
> Perintah `/triage` dapat dipanggil secara mandiri untuk mengevaluasi status kelulusan review suatu story tanpa harus mengulang kembali fase ATDD, koding, atau review sebelumnya.
>
> 🛡️ **Prinsip D2 (Zero-Gap Determinism):**  
> Kode produksi HANYA boleh di-commit jika mencapai skor mutlak **100/100 PASS** dengan 0 temuan pelanggaran kriteria atau hukum besi.

---

## Penggunaan

### Di Dalam Sesi OMP Harness
```bash
/ompimpa:triage <STORY_ID>           # Contoh: /ompimpa:triage D-02
/triage <STORY_ID>                   # Alias singkat
```

### Di Terminal OS Shell (Outer CLI)
```bash
ompimpa triage <STORY_ID>            # Menjalankan kalkulasi skor & memaparkan Remediation Plan
ompimpa triage <STORY_ID> --strict   # Exit code 1 jika berstatus REMEDIATE
ompimpa triage <STORY_ID> --json     # Output hasil agregasi dan skor dalam format JSON terstruktur
```

---

## Panel Reviewer Terisolasi yang Dikonsumsi

Perintah `/triage` membaca dan memverifikasi laporan review independen yang dihasilkan oleh 10 subagent di folder `_ompimpa/review/`:

### A. 4 BMAD Spec Reviewers
1. `_ompimpa/review/<ID>-bmad_adversarial.json` ➔ Review skenario tepi, malicious payload, dan konkurensi.
2. `_ompimpa/review/<ID>-bmad_gap_verifier.json` ➔ Traceability TEA-01 (100% AC Gherkin terverifikasi pada tes).
3. `_ompimpa/review/<ID>-bmad_structural.json` ➔ Batasan arsitektur modul, blast-radius, dan modularitas.
4. `_ompimpa/review/<ID>-bmad_completeness.json` ➔ Kelengkapan implementasi terhadap seluruh klausul PRD/SPEC.

### B. 6 phxagents Tech Reviewers
5. `_ompimpa/review/<ID>-ompimpa-ironlaw.json` ➔ Kepatuhan terhadap 26 Hukum Besi Semantik Elixir.
6. `_ompimpa/review/<ID>-ompimpa-security.json` ➔ Audit keamanan OWASP, XSS, CSRF, IDOR, dan atom exhaustion.
7. `_ompimpa/review/<ID>-ompimpa-test.json` ➔ TEA Test Scorecard (≥90), deteksi flaky sleep, dan asersi longgar.
8. `_ompimpa/review/<ID>-ompimpa-verify.json` ➔ Kompilasi ketat (`--warnings-as-errors`), formatting, dan linter.
9. `_ompimpa/review/<ID>-ompimpa-ash.json` / `ecto` ➔ Anti-N+1, Ecto pinning `^`, fail-closed policies.
10. `_ompimpa/review/<ID>-ompimpa-liveview.json` / `oban` ➔ Memory assigns hygiene, Streams, Oban idempotency.

> ⚠️ **Penalti Reviewer Hilang (*Missing Reviewer Penalty*):**  
> Jika berkas review dari salah satu panel di atas tidak ditemukan atau mengalami *timeout* (>60 detik), `src/triage.ts` otomatis menambahkan temuan **P1 High (`reviewer-missing-<id>`, penalti -15 poin)** sehingga skor maksimal menjadi 85 dan status langsung **REMEDIATE**.

---

## Mekanisme Deduplikasi Hash (`file:line:ruleId`)

Sesuai ketetapan **ADR-001** dan **ADR-002**, jika beberapa reviewer independen melaporkan pelanggaran yang sama pada baris yang sama (misal `bmad_structural` dan `ompimpa-ironlaw` sama-sama melaporkan `:float` di `lib/wallet.ex:42`):
- **Kunci Unik Deduplikasi:**
  - Baris spesifik: `${file}:${line}:${ruleId}` (contoh: `lib/wallet.ex:42:01-no-float-money`).
  - Isu tingkat berkas (`line == null`): `${file}:${ruleId}` (contoh: `lib/wallet.ex:TEA-08`).
- **Peleburan Sumber (*Source Merging*):**
  - Hanya **1 entitas penalti** yang dikenakan pada skor akhir (mencegah inflasi penalti -90 menjadi -30).
  - Kolom `merged_sources` dan `sources` mencatat seluruh panel yang melaporkan isu tersebut sebagai bukti konsensus.
  - Severity tertinggi dipertahankan jika terjadi perbedaan penilaian antar panel.

---

## Rumus Penilaian Scorecard Mutu (v2 Scoring Weights)

Perhitungan skor dilakukan secara eksak berbasis 35-Row Registry (`_ompimpa/criteria_registry_35.json`):

$$\text{Score} = \max\left(0, 100 - \sum \text{penalti}\right)$$

| Severity Level | Bobot Penalti | Dampak Kelulusan | Kategori Temuan |
|---|---|---|---|
| **Critical / P0** | **-30 poin** | 🚫 **BLOCKED (REMEDIATE)** | Pelanggaran fatal Hukum Besi, kebocoran keamanan, race condition, data loss. |
| **High / P1** | **-15 poin** | 🚫 **BLOCKED (REMEDIATE)** | AC Gherkin tak teruji (TEA-01), flaky `Process.sleep`, reviewer missing, spec drift. |
| **Medium / P2-Medium** | **-5 poin** | 🚫 **BLOCKED (REMEDIATE)** | Nits arsitektur, peringatan kompilasi minor, inefisiensi query non-kritis. |
| **Low / P2-Low** | **-2 poin** | 🚫 **BLOCKED (REMEDIATE)** | Catatan pemformatan, perbaikan penamaan, saran dokumentasi minor. |

### Vonis Kelulusan (Verdict Gate)
- **`PASS`**: HANYA jika skor **100/100** dan jumlah temuan adalah **0**.  
  *(Dengan kebijakan ketat `allow_p2_nits = false`, bahkan 1 temuan Low akan mengurangi skor menjadi 98 dan memicu status REMEDIATE).*
- **`REMEDIATE`**: Jika skor **< 100** atau terdapat temuan pelanggaran dalam daftar.

---

## Remediation Plan (P0 ➔ P1 ➔ P2)

Jika vonis adalah **REMEDIATE**, perintah `/triage` menghasilkan tabel rencana remediasi terurut yang memandu perbaikan kode terfokus:

```markdown
| No | Severity | Rule ID | Berkas:Baris | Deskripsi Masalah | Rekomendasi Solusi | Sumber Reviewer |
|----|----------|---------|--------------|-------------------|--------------------|-----------------|
| 1  | Critical | IL-01   | lib/pay.ex:42| Penggunaan :float | Ganti ke :decimal   | ironlaw, struct |
| 2  | High     | TEA-01  | test/...exs  | AC-02 belum diuji | Tambahkan asersi   | gap_verifier    |
```

### Auto-Append Knowledge Base (`rules/pitfalls.md`)
Temuan P0/P1 yang berulang secara otomatis dicatat ke dalam:
- `rules/pitfalls.md` ➔ Mencegah agen di masa depan melakukan kesalahan yang sama.
- `_ompimpa/solutions/SOL-[ID].md` ➔ Menjadi katalog solusi teruji (*proven pattern*).

---

## Integrasi Rantai Perintah (Outer Loop Pipeline)

Sesuai arsitektur **ADR-002**, posisi `/triage` adalah gerbang vonis akhir dari 5 fase rekayasa:
1. `/ompimpa:story <ID>` ➔ Kontrak mikro JIT `SPEC-[ID].md`.
2. `/atdd <ID>` ➔ Scaffolding tes merah ExUnit failing.
3. `/code <ID>` ➔ Implementasi koding hijau.
4. `/review <ID>` ➔ Dispatch 10 subagent isolated review.
5. **`/triage <ID>`** ➔ **Deduplikasi temuan dan vonis scorecard 100/100 (Fase Aktif).**

### Alur Kelanjutan:
- **Jika `PASS` (100/100):**  
  ➔ Lanjut ke **Semantic Commit** (`ompimpa-commit` / `smol`) dan pembaruan `feature-status.yaml` menjadi `status: done`.
- **Jika `REMEDIATE` (<100):**  
  ➔ Alirkan Remediation Plan kembali ke **`/code <STORY_ID>`** untuk perbaikan terfokus (maksimal 3 siklus perbaikan).

---

## Vonis Terverifikasi & Gerbang Flunk Final

- Temuan bervonis `false` (klaim terbukti tidak terjadi + `evidence`) masuk
  `rejected` dan tidak ikut skor — pola step-03 code-review.
- `[]` tanpa marker sesi = P1 `reviewer-no-evidence` (bukan bersih).
- Sisa `flunk()` di test milik story = P1 `TEA-01` di gate final
  (`auditResidualFlunk`, ter-scope file story).
