# SPEC-E-02: Flaky & Slow Test Hunter In-Band

> **Status:** Completed (100% Tests Passing — AC-E02-1 & AC-E02-2 Verified, Score 100/100 PASS)  
> **Epic:** EPIC-E — In-Band TEA & Master Diagnostic — Mutu Asersi & Unifikasi /inspect  
> **Story ID:** `E-02`  
> **Priority:** `P1` | **TEA Tier:** `P1` | **Estimate:** `S`  
> **Scoring Impact:** `TEA-08, TEA-26`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — BMM Product Governance  
> **Tanggal Terbit:** 2026-09-03  
> **Rujukan Tata Kelola:**
> - **PRD:** [`PRD-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, & Unifikasi Master Diagnostic /inspect`](_ompimpa/prd/PRD-002-dekomposisi-fase-outer-loop-inspect.md)
> - **ADR:** [`ADR-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, 10 Isolated Reviewers Sejati, & Unifikasi Master Diagnostic /inspect`](_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `E-02`)

---

## 1. Ringkasan Cerita (Story Overview)

Tambahkan deteksi larangan Process.sleep dan ambang batas in-process LiveViewTest >50ms
pada reviewer ompimpa-test dan quality gate triage.

### Ketergantungan DAG (Dependencies)
- **Depends On:** `E-01`
- **Target Files Terdaftar:** `src/reviewer.ts`, `src/triage.ts`, `rules/elixir-testing-speed.md`, `test/tea_flaky_hunter.test.ts`

---

## 2. Skenario Gherkin Presisi (ATDD Ready — TEA-01)

Skenario berikut siap di-scaffold oleh Tuanku Imam Bonjol (`/atdd E-02`) menjadi asersi uji merah (*Red-Phase*):

```gherkin
Feature: E-02 - Flaky & Slow Test Hunter In-Band
  Sebagai pengembang sistem OMP-IMPA
  Saya ingin Flaky & Slow Test Hunter In-Band
  Agar mematuhi target mutu arsitektur TEA-08, TEA-26 dan spesifikasi produk

  @ac-e02-1 @tea-01
  Scenario: AC-E02-1 - review dijalankan
    Given berkas tes memuat Process.sleep
    When review dijalankan
    Then terdeteksi P1 High flaky-sleep finding

  @ac-e02-2 @tea-01
  Scenario: AC-E02-2 - pemeriksaan kecepatan pengujian dijalankan
    Given pengujian durasi in-process LiveViewTest melebihi 50ms
    When pemeriksaan kecepatan pengujian dijalankan
    Then terdeteksi P1 High slow-test finding
```

---

## 3. Tanda Tangan Fungsi & Kontrak Antarmuka (*Function Signatures & Typespecs*)

Berikut kontrak pasti (*exact signatures, typespecs, & arity*) yang wajib dipenuhi oleh kode produksi:

#### `detectFlakyPatterns/2` (src/triage.ts)
```typescript
/** Mendeteksi pola pengujian flaky seperti Process.sleep atau sleep sewenang-wenang. */
export function detectFlakyPatterns(content: string, filePath?: string): TriageFinding[];
```

#### `checkTestSpeed/2` (src/triage.ts)
```typescript
export interface TestDurationRecord {
  name: string;
  file: string;
  durationMs: number;
  line?: number;
}

/** Memeriksa durasi eksekusi pengujian terhadap ambang batas kecepatan in-band (default 50ms). */
export function checkTestSpeed(
  records: TestDurationRecord[],
  thresholdMs?: number
): TriageFinding[];
```

#### `auditFlakyAndSlowTests/2` (src/triage.ts)
```typescript
export interface FlakyAuditOptions {
  repoRoot?: string;
  testFiles?: string[];
  durations?: TestDurationRecord[];
  speedThresholdMs?: number;
}

export interface FlakyAuditResult {
  storyId: string;
  flakyFindings: TriageFinding[];
  slowFindings: TriageFinding[];
  findings: TriageFinding[];
}

/** Mengaudit berkas pengujian terhadap pola flaky (Process.sleep) dan batas durasi >50ms secara in-band. */
export async function auditFlakyAndSlowTests(
  storyId: string,
  opts?: FlakyAuditOptions
): Promise<FlakyAuditResult>;
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
- `src/reviewer.ts`
- `src/triage.ts`
- `rules/elixir-testing-speed.md`

### Berkas Uji ATDD (*Red-Phase Targets*)
- `test/tea_flaky_hunter.test.ts`

---

## 7. Batas Penghentian & Gerbang Kualitas (*Kill Criteria & Quality Gates*)

- **Kill Criteria:**
  - _Tidak ada kill criteria spesifik (mengikuti aturan umum timeout 60s per reviewer)._
- **In-Band TEA Compliance:**
  - **TEA-01 Traceability:** 100% Kriteria Penerimaan Gherkin di atas wajib terikat pada asersi tes.
  - **Flaky & Latency Guard:** Dilarang menggunakan `Process.sleep` dan waktu eksekusi unit test wajib < 50ms.
  - **Mutation Guard:** Dilarang menggunakan asersi longgar/formalitas demi mencegah *false greens*.
- **Ambang Lolos Scorecard:** Wajib mencapai skor **100/100 PASS** pada evaluasi `/triage E-02`.
