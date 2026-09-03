# SPEC-E-03: Master Diagnostic Out-of-Band (/ompimpa:inspect)

> **Status:** Completed (100% Tests Passing — AC-E03-1 Verified, Score 100/100 PASS)  
> **Epic:** EPIC-E — In-Band TEA & Master Diagnostic — Mutu Asersi & Unifikasi /inspect  
> **Story ID:** `E-03`  
> **Priority:** `P2` | **TEA Tier:** `P2` | **Estimate:** `M`  
> **Scoring Impact:** `TEA-15, TEA-24, TEA-35`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — BMM Product Governance  
> **Tanggal Terbit:** 2026-09-03  
> **Rujukan Tata Kelola:**
> - **PRD:** [`PRD-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, & Unifikasi Master Diagnostic /inspect`](_ompimpa/prd/PRD-002-dekomposisi-fase-outer-loop-inspect.md)
> - **ADR:** [`ADR-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, 10 Isolated Reviewers Sejati, & Unifikasi Master Diagnostic /inspect`](_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `E-03`)

---

## 1. Ringkasan Cerita (Story Overview)

Unifikasi audit, boundaries, perf, dan techdebt ke dalam dokumen spesifikasi dan antarmuka perintah terpadu `commands/inspect.md` serta engine `src/inspeksi.ts`.
Perintah ini beroperasi *out-of-band* (di luar *inner loop* pengerjaan story aktif). Hasil pemindaian 4 pilar di-triage secara otomatis:
- Temuan **P0/P1** (Critical / High) pada pilar Batas (boundaries/circular dependencies) dan Performa (latency, kueri N+1, assigns bloat) otomatis diterbitkan menjadi story perbaikan baru di bawah `EPIC-DEBT` pada `_ompimpa/stories.yaml`.
- Temuan **P2/P3** (Medium / Low) dicatat ke `_ompimpa/deferred.md` sebagai daftar hutang teknis jangka panjang.
- Mematuhi **Invariant INV-11 (Out-of-Band Inspection Isolation)**: Perintah `/inspect` dilarang keras mengubah atau memutasi status story yang sedang aktif di `_ompimpa/status/feature-status.yaml`.

### Ketergantungan DAG (Dependencies)
- **Depends On:** `A-03` (Port 35-Row Criteria Registry 100/100), `C-06` (Inspeksi 4-Pilar Scorecard)
- **Target Files Terdaftar:** `commands/inspect.md`, `src/inspeksi.ts`, `src/cli.ts`, `_ompimpa/inspeksi/`, `test/inspect.test.ts`

---

## 2. Skenario Gherkin Presisi (ATDD Ready — TEA-01)

Skenario berikut disiapkan untuk Tuanku Imam Bonjol (`/atdd E-03`) untuk scaffolding asersi uji merah (*Red-Phase*):

```gherkin
Feature: E-03 - Master Diagnostic Out-of-Band (/ompimpa:inspect)
  Sebagai pengembang sistem OMP-IMPA
  Saya ingin Master Diagnostic Out-of-Band (/ompimpa:inspect)
  Agar mematuhi target mutu arsitektur TEA-15, TEA-24, TEA-35 dan spesifikasi produk

  @ac-e03-1 @tea-01
  Scenario: AC-E03-1 - pemindaian /inspect mendeteksi temuan P0/P1 boundaries atau perf issue
    Given codebase dipindai dengan /inspect
    When ditemukan P0/P1 boundaries atau perf issue
    Then otomatis di-triage dan di-generate menjadi story perbaikan di stories.yaml
```

---

## 3. Tanda Tangan Fungsi & Kontrak Antarmuka (*Function Signatures & Typespecs*)

Berikut kontrak pasti (*exact signatures, typespecs, & arity*) yang wajib dipenuhi oleh kode produksi:

#### `InspeksiFinding` & `InspeksiResult` (src/inspeksi.ts)
```typescript
export type InspeksiPilar = "batas" | "performa" | "keamanan" | "docs";

export interface InspeksiFinding {
  id?: string;
  pillar: InspeksiPilar;
  severity: "P0" | "P1" | "P2" | "P3";
  title: string;
  description: string;
  ruleId?: string;
  target_files?: string[];
  tea_tier?: "P0" | "P1" | "P2";
  remediation?: string;
  file?: string;
  line?: number;
}

export interface InspeksiOptions {
  repoRoot?: string;
  targetDir?: string;
  autoTriageDebt?: boolean; // default true: otomatis generate EPIC-DEBT
  dryRun?: boolean;
  filterPillar?: InspeksiPilar;
}

export interface InspeksiResult {
  scores: PilarScores;
  reportPath: string;
  details: Record<string, unknown>;
  findings: InspeksiFinding[];
  generatedStories: Array<{ id: string; title: string; epic: string }>;
  deferredEntries: InspeksiFinding[];
}
```

#### `runInspeksi/2` (src/inspeksi.ts)
```typescript
/**
 * Menjalankan master diagnostic out-of-band 4 pilar (Batas, Performa, Keamanan, Docs)
 * dan mengotomatiskan triage temuan P0/P1 menjadi EPIC-DEBT di stories.yaml.
 */
export async function runInspeksi(
  targetDir?: string,
  options?: InspeksiOptions
): Promise<InspeksiResult>;
```

#### `generateDebtStories/2` (src/inspeksi.ts)
```typescript
/**
 * Menerbitkan temuan P0/P1 menjadi user stories di bawah EPIC-DEBT pada stories.yaml,
 * serta mencatat temuan P2/P3 ke deferred.md tanpa mengubah feature-status.yaml (INV-11).
 */
export async function generateDebtStories(
  findings: InspeksiFinding[],
  targetDir?: string
): Promise<{
  createdStories: Array<{ id: string; title: string; epic: string }>;
  deferredEntries: InspeksiFinding[];
}>;
```

#### `handleInspect/2` (src/cli.ts & src/inspeksi.ts)
```typescript
/**
 * CLI runner untuk sub-command 'inspect' (dan alias backward-compat 'inspeksi').
 */
export async function handleInspect(
  args: string[],
  repoRoot?: string
): Promise<InspeksiResult>;
```

---

## 4. Skema Data & Konfigurasi Ecto / Ash Resource

> Story ini bertipe tooling/file-backed; tidak memerlukan skema basis data atau migrasi Ecto/Ash.
> Struktur data persisten mengelola:
> - `_ompimpa/stories.yaml` (append `epics: - id: EPIC-DEBT` dan `stories: - id: DEBT-...`)
> - `_ompimpa/deferred.md` (append entri hutang teknis non-kritis P2/P3)
> - `_ompimpa/inspeksi/report.md` (scorecard 4 pilar visual)

---

## 5. Analisis Dampak & Blast-Radius (*Lazy mix xref*)

- **Menyentuh Core Context:** `Tidak`
- **Metode Pemindaian:** `leaf_isolated`
- **Ringkasan Dampak:** Modul diagnostik out-of-band terisolasi — menyatukan `commands/inspect.md`, `src/inspeksi.ts`, dan registrasi sub-command `inspect` pada `src/cli.ts`.
- **Modul / Callers Terdampak:**
  - `src/cli.ts` (penambahan sub-command `inspect` dan routing `handleInspect`)
  - `commands/inspect.md` (berkas dokumentasi perintah baru)

---

## 6. Berkas Target Implementasi & Berkas Tes (*Target Files & Test Files*)

### Berkas Implementasi Produksi
- `commands/inspect.md` *(baru)*
- `src/inspeksi.ts`
- `src/cli.ts`
- `_ompimpa/inspeksi/`

### Berkas Uji ATDD (*Red-Phase Targets*)
- `test/inspect.test.ts` *(baru)*

---

## 7. Batas Penghentian & Gerbang Kualitas (*Kill Criteria & Quality Gates*)

- **Kill Criteria:**
  - Jika inspeksi seluruh codebase memakan waktu >15 detik, gunakan pemindaian paralel atau cache graphify.
- **In-Band TEA Compliance:**
  - **TEA-01 Traceability:** 100% Kriteria Penerimaan Gherkin di atas wajib terikat pada asersi tes.
  - **TEA-15 & TEA-16:** Validasi siklus dan batasan modular domain.
  - **TEA-24 & TEA-35:** Otomasi backlog debt & sinkronisasi Diátaxis documentation scorecard.
- **Invariant INV-11 (Out-of-Band Inspection Isolation):**
  - Perintah `/inspect` dilarang keras mengubah `_ompimpa/status/feature-status.yaml`.
- **Ambang Lolos Scorecard:** Wajib mencapai skor **100/100 PASS** pada evaluasi `/triage E-03`.
