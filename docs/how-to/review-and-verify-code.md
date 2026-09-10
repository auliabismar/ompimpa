# How-To: Menjalankan Review Paralel dan Verifikasi Mutu Strict

Panduan ini menjelaskan cara melakukan audit menyeluruh terhadap 26 Hukum Besi, keamanan perimeter, mutu tes, dan kompilator sebelum kode di-merge ke branch utama.

---

## 1. Menjalankan Panel Review 10 Subagent Terisolasi (`/ompimpa:review`)

Jalankan perintah review pada story tertentu atau branch Anda:

```bash
/ompimpa:review A-01
# Atau review seluruh perubahan staged:
/ompimpa:review --staged
```

### Panel Review Ganda 10 Subagent Sejati (Anti-Mocking):
*(Catatan: Kesalahan sintaktis primitif seperti uang `:float` atau `String.to_atom` sudah otomatis dicegah di **Tier 0** oleh engine TTSR saat koding berlangsung).*

Sistem menjalankan batch subagent terisolasi (`task(isolated: true)`) tanpa bias konfirmasi, dan menyimpan berkas temuan murni di `_ompimpa/review/[ID]-[agent].json`:

#### A. Jalur Review Fungsional & Spesifikasi (4 Lensa BMAD)
1. **`bmad_adversarial`**: Memeriksa potensi bypass batasan, celah abuse fungsional, dan skenario kegagalan destruktif.
2. **`bmad_gap_verifier`**: Memeriksa ketertelusuran 100% kriteria penerimaan Gherkin (TEA-01 Traceability) terhadap asersi tes di disk.
3. **`bmad_structural`**: Memeriksa batas tanggung jawab arsitektural dan konsistensi modularitas kode.
4. **`bmad_completeness`**: Memeriksa kelengkapan seluruh artefak yang dijanjikan dalam spesifikasi mikro JIT (`_ompimpa/specs/SPEC-[ID].md`).

#### B. Jalur Kepatuhan Teknis (6 phxagents Specialist Panel)
5. **Jalur Hukum Besi Semantik (`ompimpa-ironlaw` - Hj. Rasuna Said)**:
   Memindai seluruh diff git terhadap invariant arsitektur tingkat tinggi (otorisasi socket dinamis di setiap `handle_event/3`, supervisi proses di `application.ex`, dan relasi multi-berkas).
6. **Jalur Keamanan Perimeter (`ompimpa-security` - Bagindo Azizchan)**:
   Memindai celah keamanan mendalam (CSRF tokens, otorisasi IDOR, perlindungan sesi, dan audit Hex dependencies).
7. **Jalur Mutu Pengujian & Anti-Flaky (`ompimpa-test` - Tuanku Imam Bonjol)**:
   Menilai suite tes dengan scorecard 100/100 v2 (Critical -30, High -15, Medium -5, Low -2; PASS hanya 100), audit mutation guard, larangan `Process.sleep`, dan batas kecepatan LiveViewTest <50ms.
8. **Jalur Verifikasi Statis (`ompimpa-verify`)**:
   Menjalankan kompilasi strict (`mix compile --warnings-as-errors`) dan format check.
9. **Jalur Database & Query (`ompimpa-ecto` / `ash`)**:
   Memindai potensi anti-pattern N+1 queries, pinning operator `^` pada query Ecto, dan fail-closed Ash authorization policies.
10. **Jalur LiveView & Background Jobs (`ompimpa-liveview` / `oban`)**:
   Memeriksa memory hygiene socket assigns, Stream container pada dataset > 100 baris, dan idempotensi worker Oban.

### Triage, Deduplikasi Hash, & Scoring 100/100
Seluruh temuan dari 10 reviewer diproses oleh `/ompimpa:triage`:
1. **Deduplikasi**: Temuan yang sama pada baris yang sama digabungkan dengan kunci hash `file:line:ruleId`, mempertahankan tingkat keparahan (*severity*) tertinggi.
2. **Scoring v2 Berbasis Criteria Registry 35**:
   - Baseline: **100/100**.
   - Penalti: Critical (-30), High (-15), Medium (-5), Low (-2).
   - Standar Kelulusan: Wajib **100/100 PASS** (tanpa pelanggaran P0/P1).
3. **Remediation Plan**: Menyusun daftar perbaikan terurut dari prioritas P0 (Blocker) → P1 (Warning) → P2 (Suggestion).
---

## 2. Menjalankan Verifikasi Menyeluruh (`/ompimpa:verify`)

Sebelum menyatakan pekerjaan selesai atau membuka Pull Request (Hukum Besi #26):

```bash
/ompimpa:verify
```

### Model Verifikasi Tiga Tingkat (Tiered Verification):
* **Tier 1 (Inner Loop Gate < 2s)**:
  - `mix compile --warnings-as-errors`
  - `mix format --check-formatted`
* **Tier 2 (Per-Story Gate < 10s)**:
  - Scoped / stale test: `mix test --stale`
  - Dispatch reviewers + triage deduplikasi `file:line:ruleId` & scoring 100/100 PASS (B-01/B-02)
* **Tier 3 (Background / PR Verification Gate)**:
  - Eksekusi menyeluruh seluruh rangkaian tes proyek: `mix test`
  - Analisis statis ketat Credo: `mix credo --strict`
  - Audit keamanan Sobelow: `mix sobelow --strict --format json`
