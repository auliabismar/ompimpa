# SPEC-E-01: In-Band TEA-01 Traceability & Mutation Guard

> **Status:** Completed (100% Tests Passing — AC-E01-1 Verified, Score 100/100 PASS)  
> **Epic:** EPIC-E — In-Band TEA & Master Diagnostic — Mutu Asersi & Unifikasi /inspect  
> **Story ID:** `E-01`  
> **Priority:** `P1` | **TEA Tier:** `P1` | **Estimate:** `M`  
> **Scoring Impact:** `TEA-01, TEA-08`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — BMM Product Governance  
> **Tanggal Terbit:** 2026-09-03  
> **Rujukan Tata Kelola:**
> - **PRD:** [`PRD-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, & Unifikasi Master Diagnostic /inspect`](_ompimpa/prd/PRD-002-dekomposisi-fase-outer-loop-inspect.md)
> - **ADR:** [`ADR-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, 10 Isolated Reviewers Sejati, & Unifikasi Master Diagnostic /inspect`](_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `E-01`)

---

## 1. Ringkasan Cerita (Story Overview)

Implementasikan audit penelusuran 100% AC Gherkin vs test assertions di bmad_gap_verifier
dan deteksi asersi bodong (false greens) di src/triage.ts (Miss AC = High Finding).

### Ketergantungan DAG (Dependencies)
- **Depends On:** `D-01`
- **Target Files Terdaftar:** `src/triage.ts`, `agents/ompimpa-test.md`, `skills/tea-testing/SKILL.md`

---

## 2. Skenario Gherkin Presisi (ATDD Ready — TEA-01)

Skenario berikut siap di-scaffold oleh Tuanku Imam Bonjol (`/atdd E-01`) menjadi asersi uji merah (*Red-Phase*):

```gherkin
Feature: E-01 - In-Band TEA-01 Traceability & Mutation Guard
  Sebagai pengembang sistem OMP-IMPA
  Saya ingin In-Band TEA-01 Traceability & Mutation Guard
  Agar mematuhi target mutu arsitektur TEA-01, TEA-08 dan spesifikasi produk

  @ac-e01-1 @tea-01
  Scenario: AC-E01-1 - review/triage dieksekusi
    Given story spec memiliki 3 AC tapi tes hanya menguji 2 AC
    When review/triage dieksekusi
    Then terdeteksi TEA-01 High Finding (-15) dan skor <100
```

---

## 3. Tanda Tangan Fungsi & Kontrak Antarmuka (*Function Signatures & Typespecs*)

Berikut kontrak pasti (*exact signatures, typespecs, & arity*) yang wajib dipenuhi oleh kode produksi:

#### `handleTriage/1`
```typescript
/** Handler eksekusi utama untuk src/triage.ts. */
export async function handleTriage(args: string[]): Promise<void>;
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
- `src/triage.ts`
- `agents/ompimpa-test.md`
- `skills/tea-testing/SKILL.md`

### Berkas Uji ATDD (*Red-Phase Targets*)
- `test/triage.test.ts`

---

## 7. Batas Penghentian & Gerbang Kualitas (*Kill Criteria & Quality Gates*)

- **Kill Criteria:**
  - _Tidak ada kill criteria spesifik (mengikuti aturan umum timeout 60s per reviewer)._
- **In-Band TEA Compliance:**
  - **TEA-01 Traceability:** 100% Kriteria Penerimaan Gherkin di atas wajib terikat pada asersi tes.
  - **Flaky & Latency Guard:** Dilarang menggunakan `Process.sleep` dan waktu eksekusi unit test wajib < 50ms.
  - **Mutation Guard:** Dilarang menggunakan asersi longgar/formalitas demi mencegah *false greens*.
- **Ambang Lolos Scorecard:** Wajib mencapai skor **100/100 PASS** pada evaluasi `/triage E-01`.
