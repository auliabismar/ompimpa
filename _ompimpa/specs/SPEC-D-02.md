# SPEC-D-02: Modular Commands (/code, /triage) & Refaktor /dev

> **Status:** Completed (100% Tests Passing — AC-D02-1 Verified)  
> **Epic:** EPIC-D — Outer Loop Driver & Command Modularization — Dekomposisi Fase & Eksekusi Otonom  
> **Story ID:** `D-02`  
> **Priority:** `P1` | **TEA Tier:** `P1` | **Estimate:** `S`  
> **Scoring Impact:** `TEA-29, TEA-30`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — BMM Product Governance  
> **Tanggal Terbit:** 2026-09-03  
> **Rujukan Tata Kelola:**
> - **PRD:** [`PRD-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, & Unifikasi Master Diagnostic /inspect`](_ompimpa/prd/PRD-002-dekomposisi-fase-outer-loop-inspect.md)
> - **ADR:** [`ADR-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, 10 Isolated Reviewers Sejati, & Unifikasi Master Diagnostic /inspect`](_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `D-02`)

---

## 1. Ringkasan Cerita (Story Overview)

Buat commands/code.md, commands/triage.md, dan perbarui commands/dev.md
menjadi pipeline coordinator untuk fase atomik.

### Ketergantungan DAG (Dependencies)
- **Depends On:** `D-01`
- **Target Files Terdaftar:** `commands/code.md # baru`, `commands/triage.md # baru`, `commands/dev.md`

---

## 2. Skenario Gherkin Presisi (ATDD Ready — TEA-01)

Skenario berikut siap di-scaffold oleh Tuanku Imam Bonjol (`/atdd D-02`) menjadi asersi uji merah (*Red-Phase*):

```gherkin
Feature: D-02 - Modular Commands (/code, /triage) & Refaktor /dev
  Sebagai pengembang sistem OMP-IMPA
  Saya ingin Modular Commands (/code, /triage) & Refaktor /dev
  Agar mematuhi target mutu arsitektur TEA-29, TEA-30 dan spesifikasi produk

  @ac-d02-1 @tea-01
  Scenario: AC-D02-1 - perintah dieksekusi
    Given developer memanggil /code atau /triage mandiri
    When perintah dieksekusi
    Then berjalan modular tanpa memaksa seluruh siklus dev
```

---

## 3. Tanda Tangan Fungsi & Kontrak Antarmuka (*Function Signatures & Typespecs*)

Berikut kontrak pasti (*exact signatures, typespecs, & arity*) yang wajib dipenuhi oleh kode produksi:

#### `handleCode/1`
```typescript
/** Handler eksekusi utama untuk commands/code.md. */
export async function handleCode(args: string[]): Promise<void>;
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
- `commands/code.md`
- `commands/triage.md`
- `commands/dev.md`

### Berkas Uji ATDD (*Red-Phase Targets*)
- `test/d_02_spec.test.ts`

---

## 7. Batas Penghentian & Gerbang Kualitas (*Kill Criteria & Quality Gates*)

- **Kill Criteria:**
  - _Tidak ada kill criteria spesifik (mengikuti aturan umum timeout 60s per reviewer)._
- **In-Band TEA Compliance:**
  - **TEA-01 Traceability:** 100% Kriteria Penerimaan Gherkin di atas wajib terikat pada asersi tes.
  - **Flaky & Latency Guard:** Dilarang menggunakan `Process.sleep` dan waktu eksekusi unit test wajib < 50ms.
  - **Mutation Guard:** Dilarang menggunakan asersi longgar/formalitas demi mencegah *false greens*.
- **Ambang Lolos Scorecard:** Wajib mencapai skor **100/100 PASS** pada evaluasi `/triage D-02`.
