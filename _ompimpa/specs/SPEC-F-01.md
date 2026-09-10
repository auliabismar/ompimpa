---
title: 'F-01 - Stat-Gated State Reader & Active Session Tailer'
type: 'feature'
created: '2026-09-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
spec: '_ompimpa/specs/SPEC-F-01.md'
prd: '_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md'
adr: '_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md'
---

# SPEC-F-01: Stat-Gated State Reader & Active Session Tailer

> **Status:** Done (TEA-01 PASS) — micro-contract tunggal  
> **Epic:** EPIC-F — Native Terminal UI (TUI) Dashboard & Real-Time Observer  
> **Story ID:** `F-01`  
> **Priority:** `P0` | **TEA Tier:** `P0` | **Estimate:** `M`  
> **Scoring Impact:** `TEA-01, TEA-08, TEA-15`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — Tata Kelola OMP-IMPA  
> **Tanggal Terbit:** 2026-09-09  
> **Rujukan Tata Kelola:**
> - **SSOT:** `_upstream/bmad-loop/src/bmad_loop/tui/data.py` (`RunWatcher`, `JournalTail`)
> - **PRD:** [`PRD-003: OMP-IMPA Native Terminal UI Dashboard & Real-Time Observer`](_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md)
> - **ADR:** [`ADR-003: Native TypeScript Terminal UI Engine dengan Zero-Dependency ANSI Renderer`](_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `F-01`)

---

<frozen-after-approval reason="human-owned intent — dilarang diubah agen/dev/review kecuali manusia menegosiasi ulang">

## Intent

**Problem:** Komponen TUI membutuhkan lapisan observasi berkas yang aman, tidak memblokir I/O, dan tidak memicu galat saat membaca stream JSONL yang sedang ditulis secara bertahap oleh sub-agen `omp`.

**Approach:** Bangun `src/tui/data.ts` dengan teknik *stat-gated caching* untuk file YAML (`feature-status.yaml`, `stories.yaml`) dan *incremental byte-offset tracking* dengan *line boundary guard* untuk pembacaan berkas sesi JSONL `~/.omp/agent/sessions/`.

## Boundaries & Constraints

**Always:**
- Stat-gating memeriksa kombinasi `(mtimeMs, size)`. Jika tidak berubah, kembalikan objek memori sebelumnya tanpa I/O baca disk.
- Buffer parsial JSONL hanya mem-parsing baris yang diakhiri `\n`. Baris tak lengkap ditahan hingga flush berikutnya.
- 100% Kriteria Penerimaan (§2) terikat ke asersi otomatis di `test/tui_data.test.ts`.

**Never:**
- Dilarang menulis balik ke file state proyek (TUI bersifat *pure read-only observer*).
- Dilarang melempar uncaught exception saat berkas sesi atau direktori `_ompimpa` belum ada (kembalikan empty/fallback state).

</frozen-after-approval>

---

## 0. Open Questions (Gerbang Siap-Kembang)

_Tidak ada pertanyaan terbuka. Siap untuk ATDD Fase Merah._

---

## 1. Ringkasan Cerita (Story Overview)

Story ini meletakkan fondasi data bagi antarmuka TUI OMP-IMPA, mengadopsi pola arsitektur dari `_upstream/bmad-loop/src/bmad_loop/tui/data.py` (`RunWatcher` dan `JournalTail`) yang dialihkan ke TypeScript/Bun native.

Modul ini bertanggung jawab untuk:
1. Memindai status seluruh cerita dalam Epic dari `_ompimpa/status/feature-status.yaml` dan metadata dari `_ompimpa/stories.yaml`.
2. Menemukan berkas sesi `omp` terbaru yang relevan di `~/.omp/agent/sessions/-<project-hash>/`.
3. Mem-parsing pertambahan baris JSONL secara inkremental menjadi event bertipe (`toolCall`, `toolResult`, `thinking`, `text`).
4. Mendeteksi status keaktifan proses (*liveness*) melalui pemeriksaan PID engine dan sub-agen.

---

## 2. Kriteria Penerimaan (Acceptance Criteria)

### AC-F01-1: Stat-Gated Kanban State Loading
- **Given:** Direktori target memuat `_ompimpa/status/feature-status.yaml` dan `stories.yaml`.
- **When:** Fungsi `loadKanbanState(targetDir)` dipanggil.
- **Then:** Mengembalikan objek `KanbanState` yang memuat daftar story terurut, status saat ini (`done`, `in-progress`, `ready-for-dev`, dll), dan tier TEA.

### AC-F01-2: In-Memory Stat Caching
- **Given:** Pemanggilan `loadKanbanState(targetDir)` telah dilakukan satu kali.
- **When:** `loadKanbanState(targetDir)` dipanggil kembali tanpa adanya perubahan `mtime` atau `size` pada berkas YAML.
- **Then:** Mengembalikan referensi cache memori sebelumnya tanpa pembacaan berkas ulang dari disk.

### AC-F01-3: Line Boundary Guard pada JSONL Tailer
- **Given:** Berkas sesi JSONL memiliki baris terakhir yang belum selesai ditulis (terpotong, tanpa karakter `\n`).
- **When:** `tailSession(sessionPath, state)` membaca byte baru dari disk.
- **Then:** Parser menahan fragmen baris di buffer internal dan tidak memicu `SyntaxError: Unexpected end of JSON input`.

### AC-F01-4: Structured Session Event Extraction
- **Given:** Berkas sesi JSONL menerima baris lengkap berisi event `toolCall` (`bash`, `edit`, `read`, `write`).
- **When:** `tailSession()` mem-parsing baris tersebut.
- **Then:** Mengembalikan array `SessionEvent[]` dengan tipe `tool_call`, nama tool, argumen yang dinormalisasi, dan penanda waktu yang valid.

---

## 3. Antarmuka Teknis & Signature API (`src/tui/data.ts`)

```typescript
export interface StoryStatusItem {
  id: string;
  title: string;
  epic: string;
  status: "done" | "in-progress" | "in-review" | "ready-for-dev" | "ready-for-atdd" | "backlog" | "failed";
  tea_tier: string;
  priority: string;
  retries: number;
}

export interface KanbanState {
  epicId: string;
  stories: StoryStatusItem[];
  activeStoryId: string | null;
  lastUpdated: number;
}

export interface SessionEvent {
  id: string;
  timestamp: string;
  type: "tool_call" | "tool_result" | "thinking" | "text" | "unknown";
  toolName?: string;
  toolArgs?: Record<string, any>;
  content: string;
}

export class StatGatedReader {
  constructor(private targetDir: string);
  loadKanbanState(): KanbanState;
  findLatestSessionFile(): string | null;
  tailSessionEvents(sessionFilePath: string): SessionEvent[];
}
```

---

## 4. Matriks Risiko & Rencana Pengujian (TEA-01 Traceability)

| Kode AC | Kategori Risiko | Target Pengujian | File Pengujian |
|---|---|---|---|
| **AC-F01-1** | P0 (Critical) | Validitas parsing struktur Kanban dari YAML | `test/tui_data.test.ts` |
| **AC-F01-2** | P1 (Perf) | Stat-gating cache hit (zero redundant disk read) | `test/tui_data.test.ts` |
| **AC-F01-3** | P0 (Crash Guard) | Partial un-flushed line tolerance (boundary guard) | `test/tui_data.test.ts` |
| **AC-F01-4** | P0 (Data Invariant) | Structured toolCall & thinking parsing | `test/tui_data.test.ts` |

---

## 5. Target Files

- `src/tui/data.ts` *(berkas baru)*
- `test/tui_data.test.ts` *(berkas baru)*

---

## 6. Kill Criteria
## 7. Riwayat Review & Scorecard

### Review ATDD & Implementation (2026-09-09)
- **Tests:** `test/tui_data.test.ts` (4 pass, 0 fail, 30 assertions)
- **AC Traceability:**
  - AC-F01-1 (Kanban State Loading): PASS (100%)
  - AC-F01-2 (Stat-Gated Caching): PASS (100%)
  - AC-F01-3 (Line Boundary Guard): PASS (100%)
  - AC-F01-4 (Structured Session Events): PASS (100%)
- **Skor TEA:** 100/100 (Pass Quality Gate)
---
