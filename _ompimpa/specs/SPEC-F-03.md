---
title: 'F-03 - Story Kanban & Active Contract Inspector Pane'
type: 'feature'
created: '2026-09-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
spec: '_ompimpa/specs/SPEC-F-03.md'
prd: '_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md'
adr: '_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md'
---

# SPEC-F-03: Story Kanban & Active Contract Inspector Pane

> **Status:** Done (TEA-01 PASS) — micro-contract tunggal  
> **Epic:** EPIC-F — Native Terminal UI (TUI) Dashboard & Real-Time Observer  
> **Story ID:** `F-03`  
> **Priority:** `P0` | **TEA Tier:** `P0` | **Estimate:** `S`  
> **Scoring Impact:** `TEA-01, TEA-15, TEA-22`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — Tata Kelola OMP-IMPA  
> **Tanggal Terbit:** 2026-09-09  
> **Rujukan Tata Kelola:**
> - **SSOT:** `_upstream/bmad-loop/src/bmad_loop/tui/widgets.py` (`StoriesTable`, `status_cell`, `STATUS_GLYPHS`, `STATUS_STYLES`)
> - **PRD:** [`PRD-003: OMP-IMPA Native Terminal UI Dashboard & Real-Time Observer`](_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md)
> - **ADR:** [`ADR-003: Native TypeScript Terminal UI Engine dengan Zero-Dependency ANSI Renderer`](_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `F-03`)

---

<frozen-after-approval reason="human-owned intent — dilarang diubah agen/dev/review kecuali manusia menegosiasi ulang">

## Intent

**Problem:** Operator memerlukan visualisasi kanban ringkas atas status kemajuan cerita (`stories.yaml` & `feature-status.yaml`) serta kartu ringkasan kontrak mikro (`Intent`, `Target Files`, `AC checklist`) dari cerita yang sedang aktif/dipilih.

**Approach:** Bangun `src/tui/panes/stories.ts` yang merender tabel cerita Kanban dengan glif status visual berwarna (`STATUS_GLYPHS`: `▶`, `✔`, `⏳`, `✖`, `⏸`), nomor iterasi retries, dan kartu detail spesifikasi story.

## Boundaries & Constraints

**Always:**
- Format visual glif status harus konsisten 1:1 dengan SSOT `bmad-loop`:
  - `done` $\to$ `✔` (hijau/dim)
  - `in-progress` / `in-review` $\to$ `▶` (kuning/bold cyan)
  - `backlog` / `ready-*` $\to$ `⏳` (putih/dim)
  - `failed` / `crashed` $\to$ `✖` (merah bold)
- Pemotongan judul cerita di tabel wajib mempertahankan lebar batas kolom tanpa merusak garis vertikal border panel.
- 100% Kriteria Penerimaan (§2) terikat ke asersi otomatis di `test/tui_stories.test.ts`.

**Never:**
- Dilarang mengasumsikan ID cerita berurutan tanpa memperhatikan metadata DAG (`depends_on`).

</frozen-after-approval>

---

## 0. Open Questions (Gerbang Siap-Kembang)

_Tidak ada pertanyaan terbuka. Siap untuk ATDD Fase Merah._

---

## 1. Ringkasan Cerita (Story Overview)

Story ini mengadopsi komponen `StoriesTable` dan `status_cell` dari `_upstream/bmad-loop/src/bmad_loop/tui/widgets.py`. Komponen ini menghasilkan dua elemen antarmuka:
1. **Daftar Cerita (Kanban Table):** Berada di sidebar kiri, menampilkan indikator kursor `>` untuk cerita yang sedang dipilih, glif status, ID cerita (`19-1`, `19-2`), tier TEA (`P0`/`P1`), dan cuplikan judul cerita.
2. **Kartu Kontrak Cerita (Story Card):** Menampilkan ringkasan spesifikasi mikro: Judul lengkap, berkas target, dan daftar Acceptance Criteria Gherkin yang dibaca dari `_ompimpa/specs/SPEC-<id>.md`.

---

## 2. Kriteria Penerimaan (Acceptance Criteria)

### AC-F03-1: Kanban Status Glyph Mapping
- **Given:** Kumpulan objek status cerita dengan status `done`, `in-progress`, `in-review`, `backlog`, dan `failed`.
- **When:** Fungsi `renderStoriesTable()` dipanggil.
- **Then:** Setiap baris cerita memuat glif status yang benar (`✔`, `▶`, `⏳`, `✖`) dengan pewarnaan ANSI yang sesuai.

### AC-F03-2: Story Selection Indicator & Auto-Focus
- **Given:** Indeks cerita terpilih bernilai $N$.
- **When:** Tabel cerita dirender.
- **Then:** Baris ke-$N$ ditandai dengan sorotan latar belakang atau prefiks kursor `>` yang membedakannya dari baris lain.

### AC-F03-3: Active Contract Detail Card Rendering
- **Given:** Cerita yang dipilih memiliki berkas spesifikasi di `_ompimpa/specs/SPEC-[ID].md`.
- **When:** Fungsi `renderStoryCard(story, specContent, width)` dipanggil.
- **Then:** Menghasilkan baris terformat yang memuat: Judul Cerita, Target Files, dan checklist kriteria penerimaan Gherkin.

### AC-F03-4: Graceful Fallback on Missing Spec
- **Given:** Cerita yang dipilih belum memiliki berkas spesifikasi `SPEC-[ID].md` (masih tahap backlog awal).
- **When:** `renderStoryCard()` dipanggil.
- **Then:** Menampilkan kartu ringkasan berbasis data `stories.yaml` tanpa melempar galat berkas tidak ditemukan (*file not found error*).

---

## 3. Antarmuka Teknis & Signature API (`src/tui/panes/stories.ts`)

```typescript
import { StoryStatusItem } from "../data";

export interface RenderStoriesOptions {
  stories: StoryStatusItem[];
  selectedIndex: number;
  width: number;
  height: number;
}

export interface RenderCardOptions {
  story: StoryStatusItem;
  specMarkdown?: string;
  width: number;
  height: number;
}

export function renderStoriesTable(options: RenderStoriesOptions): string[];
export function renderStoryCard(options: RenderCardOptions): string[];
```

---

## 4. Matriks Risiko & Rencana Pengujian (TEA-01 Traceability)

| Kode AC | Kategori Risiko | Target Pengujian | File Pengujian |
|---|---|---|---|
| **AC-F03-1** | P0 (Visual Semantics) | Status glyph & ANSI style accuracy | `test/tui_stories.test.ts` |
| **AC-F03-2** | P1 (Navigation) | Active selection highlight indicator | `test/tui_stories.test.ts` |
| **AC-F03-3** | P0 (Contract Audit) | Spec card Gherkin AC rendering | `test/tui_stories.test.ts` |
| **AC-F03-4** | P1 (Resilience) | Missing spec fallback handling | `test/tui_stories.test.ts` |

---

## 5. Target Files

- `src/tui/panes/stories.ts` *(berkas baru)*
- `test/tui_stories.test.ts` *(berkas baru)*

---

## 6. Kill Criteria

- Jika rendering tabel cerita memotong ID cerita utama (`19-2`) pada sidebar 30 kolom, prioritaskan ID dan glif di atas panjang judul cerita.

---

## 7. Riwayat Review & Scorecard

### Review ATDD & Implementation (2026-09-09)
- **Tests:** `test/tui_stories.test.ts` (4 pass, 0 fail, 43 assertions)
- **AC Traceability:**
  - AC-F03-1 (Kanban Status Glyph Mapping): PASS (100%)
  - AC-F03-2 (Story Selection Indicator): PASS (100%)
  - AC-F03-3 (Active Contract Detail Card): PASS (100%)
  - AC-F03-4 (Graceful Fallback on Missing Spec): PASS (100%)
- **Skor TEA:** 100/100 (Pass Quality Gate)
