# SPEC-D-03: Penegakan 10 Isolated Reviewers Sejati (Anti-Mocking)

> **Status:** Ready for ATDD (TEA-01)  
> **Epic:** EPIC-D — Outer Loop Driver & Command Modularization — Dekomposisi Fase & Eksekusi Otonom  
> **Story ID:** `D-03`  
> **Priority:** `P0` | **TEA Tier:** `P0` | **Estimate:** `M`  
> **Scoring Impact:** `TEA-01, TEA-29`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — BMM Product Governance  
> **Tanggal Terbit:** 2026-09-03  
> **Rujukan Tata Kelola:**
> - **PRD:** [`PRD-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, & Unifikasi Master Diagnostic /inspect`](_ompimpa/prd/PRD-002-dekomposisi-fase-outer-loop-inspect.md)
> - **ADR:** [`ADR-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, 10 Isolated Reviewers Sejati, & Unifikasi Master Diagnostic /inspect`](_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `D-03`)

---

## 1. Ringkasan Cerita (Story Overview)

Perbarui commands/review.md dengan batch tool task(isolated: true) 10 subagent
dan bersihkan mock regex inline di src/reviewer.ts:dispatchIsolatedReview().

### Ketergantungan DAG (Dependencies)
- **Depends On:** `B-01`, `B-03`
- **Target Files Terdaftar:** `commands/review.md`, `src/reviewer.ts`, `test/reviewer_isolated.test.ts`

---

## 2. Skenario Gherkin Presisi (ATDD Ready — TEA-01)

Skenario berikut siap di-scaffold oleh Tuanku Imam Bonjol (`/atdd D-03`) menjadi asersi uji merah (*Red-Phase*):

```gherkin
Feature: D-03 - Penegakan 10 Isolated Reviewers Sejati (Anti-Mocking)
  Sebagai pengembang sistem OMP-IMPA
  Saya ingin Penegakan 10 Isolated Reviewers Sejati (Anti-Mocking)
  Agar mematuhi target mutu arsitektur TEA-01, TEA-29 dan spesifikasi produk

  @ac-d03-1 @tea-01
  Scenario: AC-D03-1 - dispatchIsolatedReview dipanggil
    Given review dijalankan
    When dispatchIsolatedReview dipanggil
    Then 10 JSON di _ompimpa/review/ ditulis murni oleh subagent, bukan inline prewalk mock
```

---

## 3. Tanda Tangan Fungsi & Kontrak Antarmuka (*Function Signatures & Typespecs*)

Berikut kontrak pasti (*exact signatures, typespecs, & arity*) yang wajib dipenuhi oleh kode produksi:

#### `handleReviewer/1`
```typescript
/** Handler eksekusi utama untuk src/reviewer.ts. */
export async function handleReviewer(args: string[]): Promise<void>;
```

---

## 4. Skema Data & Konfigurasi Ecto / Ash Resource

> Story ini bertipe stateless/tooling/file-backed; tidak memerlukan skema basis data atau migrasi Ecto/Ash.


---

## 5. Analisis Dampak & Blast-Radius (*Lazy mix xref*)

- **Menyentuh Core Context:** `Tidak`
- **Metode Pemindaian:** `leaf_isolated`
- **Ringkasan Dampak:** Modul perifer/tooling terisolasi — tidak menyentuh core context atau skema database inti.
- **Modul / Callers Terdampak:**
  - _Tidak ada pemanggil eksternal terdampak (modul perifer atau leaf)._

---

## 6. Berkas Target Implementasi & Berkas Tes (*Target Files & Test Files*)

### Berkas Implementasi Produksi
- `commands/review.md`
- `src/reviewer.ts`

### Berkas Uji ATDD (*Red-Phase Targets*)
- `test/reviewer_isolated.test.ts`

---

## 7. Batas Penghentian & Gerbang Kualitas (*Kill Criteria & Quality Gates*)

- **Kill Criteria:**
  - _Tidak ada kill criteria spesifik (mengikuti aturan umum timeout 60s per reviewer)._
- **In-Band TEA Compliance:**
  - **TEA-01 Traceability:** 100% Kriteria Penerimaan Gherkin di atas wajib terikat pada asersi tes.
  - **Flaky & Latency Guard:** Dilarang menggunakan `Process.sleep` dan waktu eksekusi unit test wajib < 50ms.
  - **Mutation Guard:** Dilarang menggunakan asersi longgar/formalitas demi mencegah *false greens*.
- **Ambang Lolos Scorecard:** Wajib mencapai skor **100/100 PASS** pada evaluasi `/triage D-03`.
