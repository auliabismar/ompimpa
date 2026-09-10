---
title: 'F-04 - Live Event Stream Viewer & Thinking Toggle'
type: 'feature'
created: '2026-09-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
spec: '_ompimpa/specs/SPEC-F-04.md'
prd: '_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md'
adr: '_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md'
---

# SPEC-F-04: Live Event Stream Viewer & Thinking Toggle

> **Status:** Done (TEA-01 PASS) — micro-contract tunggal  
> **Epic:** EPIC-F — Native Terminal UI (TUI) Dashboard & Real-Time Observer  
> **Story ID:** `F-04`  
> **Priority:** `P0` | **TEA Tier:** `P0` | **Estimate:** `M`  
> **Scoring Impact:** `TEA-01, TEA-08, TEA-24`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — Tata Kelola OMP-IMPA  
> **Tanggal Terbit:** 2026-09-09  
> **Rujukan Tata Kelola:**
> - **SSOT:** `_upstream/bmad-loop/src/bmad_loop/tui/widgets.py` (`JournalEntryOption`, `SelectableRichLog`) & `data.py` (`JournalTail`)
> - **PRD:** [`PRD-003: OMP-IMPA Native Terminal UI Dashboard & Real-Time Observer`](_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md)
> - **ADR:** [`ADR-003: Native TypeScript Terminal UI Engine dengan Zero-Dependency ANSI Renderer`](_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `F-04`)

---

<frozen-after-approval reason="human-owned intent — dilarang diubah agen/dev/review kecuali manusia menegosiasi ulang">

## Intent

**Problem:** Operator perlu melihat secara seketika (*real-time*) perintah apa yang sedang dieksekusi sub-agen di latar belakang (perintah shell `bash`, edit berkas, baca spesifikasi), keluaran hasil tes, dan penalaran internal model tanpa dibebani banjir teks yang tidak terstruktur.

**Approach:** Bangun `src/tui/panes/stream.ts` yang memformat event stream JSONL menjadi entri log visual berwarna (badge `⚡ [BASH]`, `✏️ [EDIT]`, `📖 [READ]`, `📝 [WRITE]`), mendukung auto-scroll baris terbaru, penyaringan penalaran (*thinking toggle* via tombol `t`), dan tab penampil log pengujian Elixir (`tmp/test-logs/`).

## Boundaries & Constraints

**Always:**
- Format event toolCall wajib memisahkan badge aksi, target/argumen berkas, dan penanda waktu secara konsisten.
- Status default `showThinking` adalah `false` agar tampilan ringkas; dapat diaktifkan menjadi `true` secara dinamis.
- 100% Kriteria Penerimaan (§2) terikat ke asersi otomatis di `test/tui_stream.test.ts`.

**Never:**
- Dilarang menelan atau menghilangkan event galat kompilasi atau tes yang dilaporkan oleh sub-agen.

</frozen-after-approval>

---

## 0. Open Questions (Gerbang Siap-Kembang)

_Tidak ada pertanyaan terbuka. Siap untuk ATDD Fase Merah._

---

## 1. Ringkasan Cerita (Story Overview)

Story ini mengimplementasikan panel utama sebelah kanan yang memvisualisasikan aktivitas sub-agen. Mengadopsi konsep `JournalEntryOption` dari `_upstream/bmad-loop/src/bmad_loop/tui/widgets.py`, panel ini memformat event mentah JSONL dari `~/.omp/agent/sessions/` menjadi tampilan yang mudah dipindai mata operator manusia.

Panel ini mendukung tiga tab navigasi:
1. **Tab 1 — Live Activity:** Menampilkan riwayat aksi tool calls (`bash`, `edit`, `read`, `write`, `todo`) dan respons ringkas.
2. **Tab 2 — Test Logs:** Menampilkan ekor (*tail*) dari berkas log pengujian `tmp/test-logs/mix-test-*.log` terbaru.
3. **Tab 3 — Contract Spec:** Menampilkan spesifikasi lengkap cerita dari `_ompimpa/specs/SPEC-<id>.md`.

---

## 2. Kriteria Penerimaan (Acceptance Criteria)

### AC-F04-1: Tool Call Badge Formatting
- **Given:** Event sesi bertipe `tool_call` dengan `toolName: "bash"` dan command `mix compile --warnings-as-errors`.
- **When:** Fungsi `formatSessionEvent(event, width)` dipanggil.
- **Then:** Menghasilkan string baris berwarna yang memuat badge kuning `⚡ [BASH]` dan cuplikan perintah.

### AC-F04-2: File Operation Badges (Edit, Read, Write)
- **Given:** Event sesi bertipe `tool_call` untuk operasi berkas (`edit`, `read`, `write`).
- **When:** Event diformat.
- **Then:** Badge yang sesuai ditampilkan: `✏️ [EDIT]` (cyan), `📖 [READ]` (biru/dim), atau `📝 [WRITE]` (hijau) beserta path berkas target.

### AC-F04-3: Thinking / Chain-of-Thought Toggle
- **Given:** Aliran event memuat blok `thinking` (penalaran internal model).
- **When:** `renderStreamPane()` dipanggil dengan `showThinking: false`, blok thinking diabaikan; saat dipanggil dengan `showThinking: true`, blok thinking ditampilkan dengan prefiks `💭 [THINK]` dan gaya redup (*dim*).

### AC-F04-4: Test Log Tailing Integration
- **Given:** Pengguna memilih Tab 2 (Test Logs) dan direktori `tmp/test-logs/` memuat berkas log uji `mix test`.
- **When:** `renderTestLogPane(targetDir, width, height)` dipanggil.
- **Then:** Mengembalikan $N$ baris terakhir dari berkas log pengujian terbaru dengan penyorotan warna pada kata kunci `passed`, `failed`, dan `error`.

---

## 3. Antarmuka Teknis & Signature API (`src/tui/panes/stream.ts`)

```typescript
import { SessionEvent } from "../data";

export type StreamTab = "activity" | "test_logs" | "spec";

export interface RenderStreamOptions {
  events: SessionEvent[];
  tab: StreamTab;
  showThinking: boolean;
  targetDir: string;
  width: number;
  height: number;
  scrollOffset?: number;
}

export function formatSessionEvent(event: SessionEvent, maxWidth: number): string[];
export function renderStreamPane(options: RenderStreamOptions): string[];
```

---

## 4. Matriks Risiko & Rencana Pengujian (TEA-01 Traceability)

| Kode AC | Kategori Risiko | Target Pengujian | File Pengujian |
|---|---|---|---|
| **AC-F04-1** | P0 (Observability) | Bash tool badge formatting & ANSI color | `test/tui_stream.test.ts` |
| **AC-F04-2** | P0 (Observability) | Edit/Read/Write badge formatting | `test/tui_stream.test.ts` |
| **AC-F04-3** | P1 (Visual Density) | Thinking toggle suppression & activation | `test/tui_stream.test.ts` |
| **AC-F04-4** | P1 (Integration) | Real-time test log tailing & keyword highlight | `test/tui_stream.test.ts` |

---

## 5. Target Files

- `src/tui/panes/stream.ts` *(berkas baru)*
- `test/tui_stream.test.ts` *(berkas baru)*

---

## 6. Kill Criteria

- Jika stream log sesi menghasilkan > 10.000 event pada satu sesi, batasi buffer memori tampilan maksimal 500 event terbaru (FIFO) untuk menjaga batas memori NFR-02 (< 35MB).

---

## 7. Riwayat Review & Scorecard

### Review ATDD & Implementation (2026-09-09)
- **Tests:** `test/tui_stream.test.ts` (6 pass, 0 fail, 20 assertions)
- **AC Traceability:**
  - AC-F04-1 (Tool Call Badge Formatting): PASS (100%)
  - AC-F04-2 (File Operation Badges): PASS (100%)
  - AC-F04-3 (Thinking / Chain-of-Thought Toggle): PASS (100%)
  - AC-F04-4 (Test Log Tailing Integration): PASS (100%)
- **Skor TEA:** 100/100 (Pass Quality Gate)
