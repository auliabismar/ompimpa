---
title: 'F-02 - ANSI Terminal Box & Layout Engine'
type: 'feature'
created: '2026-09-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
spec: '_ompimpa/specs/SPEC-F-02.md'
prd: '_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md'
adr: '_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md'
---

# SPEC-F-02: ANSI Terminal Box & Layout Engine

> **Status:** Done (TEA-01 PASS) — micro-contract tunggal  
> **Epic:** EPIC-F — Native Terminal UI (TUI) Dashboard & Real-Time Observer  
> **Story ID:** `F-02`  
> **Priority:** `P0` | **TEA Tier:** `P0` | **Estimate:** `M`  
> **Scoring Impact:** `TEA-01, TEA-08, TEA-17`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — Tata Kelola OMP-IMPA  
> **Tanggal Terbit:** 2026-09-09  
> **Rujukan Tata Kelola:**
> - **SSOT:** `_upstream/bmad-loop/src/bmad_loop/tui/screens/dashboard.py` (Geometry, splitters, layout calculation)
> - **PRD:** [`PRD-003: OMP-IMPA Native Terminal UI Dashboard & Real-Time Observer`](_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md)
> - **ADR:** [`ADR-003: Native TypeScript Terminal UI Engine dengan Zero-Dependency ANSI Renderer`](_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `F-02`)

---

<frozen-after-approval reason="human-owned intent — dilarang diubah agen/dev/review kecuali manusia menegosiasi ulang">

## Intent

**Problem:** Terminal UI membutuhkan mesin perender tata letak split-pane responsif berbasis ANSI VT100 murni yang bebas distorsi, menghitung lebar teks secara akurat meski mengandung escape codes warna, dan menggambar border kotak presisi.

**Approach:** Bangun `src/tui/terminal.ts` yang menyediakan fungsi strip ANSI, pengukuran visual string, pemotongan teks aman (anti-leaking color), border box generator Unicode/ASCII, serta manajemen buffer alternate screen (`\x1b[?1049h/l`).

## Boundaries & Constraints

**Always:**
- Perhitungan lebar kolom visual wajib menggunakan regex ANSI strip untuk mengabaikan kode kontrol (`\x1b[[0-9;]*m`).
- Setiap teks berwarna yang dipotong di tengah kalimat wajib ditutup dengan kode reset `\x1b[0m` untuk mencegah warna bocor ke border berikutnya.
- 100% Kriteria Penerimaan (§2) terikat ke asersi otomatis di `test/tui_terminal.test.ts`.

**Never:**
- Dilarang menggunakan dependensi npm pihak ketiga untuk manipulasi string atau ANSI (zero external dependencies).
- Dilarang merender melampaui lebar `process.stdout.columns` (mencegah auto-wrap terminal yang merusak baris).

</frozen-after-approval>

---

## 0. Open Questions (Gerbang Siap-Kembang)

_Tidak ada pertanyaan terbuka. Siap untuk ATDD Fase Merah._

---

## 1. Ringkasan Cerita (Story Overview)

Story ini membangun mesin grafis berbasis teks (*VT100 ANSI Graphics Engine*) untuk TUI OMP-IMPA. Terinspirasi dari perhitungan geometri splitters pada `_upstream/bmad-loop/src/bmad_loop/tui/screens/dashboard.py` (`_MIN_SIDEBAR=20`, `_MIN_DETAIL=30`), mesin ini membagi terminal ke dalam area:
1. **Header Bar:** Menampilkan nama proyek, PID engine, PID sub-agen, dan status runtime.
2. **Left Column (Sidebar):** Menampilkan daftar cerita Kanban.
3. **Right Column (Main Detail):** Menampilkan kartu spesifikasi dan tab panel (Live Activity / Test Logs).
4. **Footer Bar:** Menampilkan petunjuk tombol navigasi (`q`, `Tab`, `↑/↓`, `t`, `r`).

---

## 2. Kriteria Penerimaan (Acceptance Criteria)

### AC-F02-1: ANSI Stripping & Visible Length Calculation
- **Given:** String teks memuat kode escape warna ANSI (contoh: `\x1b[32;1mBerhasil\x1b[0m`).
- **When:** Fungsi `visibleLength(text)` dan `stripAnsi(text)` dipanggil.
- **Then:** `stripAnsi` menghasilkan string polos `"Berhasil"` dan `visibleLength` mengembalikan panjang persis 8 karakter.

### AC-F02-2: Safe ANSI Truncation with Color Reset
- **Given:** String panjang dengan warna ANSI yang melebihi batas kolom visual (contoh: lebar visual 25 karakter dipotong pada 10 karakter).
- **When:** Fungsi `truncateAnsi(text, 10)` dipanggil.
- **Then:** Mengembalikan teks sepanjang maksimal 10 karakter visual, diakhiri elipsis jika terpotong, dan selalu diakhiri dengan escape reset `\x1b[0m`.

### AC-F02-3: Precision Box Border Rendering
- **Given:** Dimensi kotak tertentu (lebar $W$, tinggi $H$, judul panel).
- **When:** Fungsi `renderBox(options)` dipanggil.
- **Then:** Menghasilkan array string baris dengan karakter sudut (`┌`, `┐`, `└`, `┘`) dan batas (`│`, `─`) dengan lebar visual persis $W$.

### AC-F02-4: Responsive Split-Pane Partitioning
- **Given:** Dimensi terminal keseluruhan (contoh $100 \times 30$).
- **When:** Fungsi `calculatePanes(cols, rows)` dipanggil.
- **Then:** Mengembalikan geometri partisi: Header (tinggi 3), Left Sidebar (lebar $\approx 32$), Right Pane (lebar sisa), dan Footer (tinggi 2) dengan kepatuhan terhadap batas minimum.

---

## 3. Antarmuka Teknis & Signature API (`src/tui/terminal.ts`)

```typescript
export interface PaneGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutGeometry {
  header: PaneGeometry;
  sidebar: PaneGeometry;
  main: PaneGeometry;
  footer: PaneGeometry;
  cols: number;
  rows: number;
}

export function stripAnsi(str: string): string;
export function visibleLength(str: string): number;
export function padAnsi(str: string, width: number, align?: "left" | "right" | "center"): string;
export function truncateAnsi(str: string, maxWidth: number): string;
export function renderBox(title: string, contentLines: string[], width: number, height: number, style?: string): string[];
export function calculateLayout(cols: number, rows: number): LayoutGeometry;
```

---

## 4. Matriks Risiko & Rencana Pengujian (TEA-01 Traceability)

| Kode AC | Kategori Risiko | Target Pengujian | File Pengujian |
|---|---|---|---|
| **AC-F02-1** | P0 (Visual Alignment) | ANSI regex measurement math | `test/tui_terminal.test.ts` |
| **AC-F02-2** | P0 (Terminal Safety) | Safe truncation & zero color bleed | `test/tui_terminal.test.ts` |
| **AC-F02-3** | P1 (Rendering) | Unicode box border closure & width | `test/tui_terminal.test.ts` |
| **AC-F02-4** | P1 (Layout) | Pane dimension math & min boundary clamping | `test/tui_terminal.test.ts` |

---

## 5. Target Files

- `src/tui/terminal.ts` *(berkas baru)*
- `test/tui_terminal.test.ts` *(berkas baru)*

---

## 6. Kill Criteria

- Jika rendering border menghasilkan baris membungkus (*wrapping*) pada terminal 80 kolom, perketat pengurangan lebar kolom visual sebesar 1 cell padding.

---

## 7. Riwayat Review & Scorecard

### Review ATDD & Implementation (2026-09-09)
- **Tests:** `test/tui_terminal.test.ts` (7 pass, 0 fail, 50 assertions)
- **AC Traceability:**
  - AC-F02-1 (ANSI Stripping & Visible Length): PASS (100%)
  - AC-F02-2 (Safe ANSI Truncation with Color Reset): PASS (100%)
  - AC-F02-3 (Precision Box Border Rendering): PASS (100%)
  - AC-F02-4 (Responsive Split-Pane Partitioning): PASS (100%)
- **Skor TEA:** 100/100 (Pass Quality Gate)
