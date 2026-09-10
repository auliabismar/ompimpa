---
title: 'F-05 - CLI Subcommand Integration, Keyboard Navigation & Lifecycle Hygiene'
type: 'feature'
created: '2026-09-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
spec: '_ompimpa/specs/SPEC-F-05.md'
prd: '_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md'
adr: '_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md'
---

# SPEC-F-05: CLI Subcommand Integration, Keyboard Navigation & Lifecycle Hygiene

> **Status:** Done (TEA-01 PASS) — micro-contract tunggal  
> **Epic:** EPIC-F — Native Terminal UI (TUI) Dashboard & Real-Time Observer  
> **Story ID:** `F-05`  
> **Priority:** `P1` | **TEA Tier:** `P1` | **Estimate:** `M`  
> **Scoring Impact:** `TEA-01, TEA-17, TEA-35`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — Tata Kelola OMP-IMPA  
> **Tanggal Terbit:** 2026-09-09  
> **Rujukan Tata Kelola:**
> - **SSOT:** `_upstream/bmad-loop/src/bmad_loop/tui/app.py` & `screens/dashboard.py` (Key bindings & resize handling)
> - **PRD:** [`PRD-003: OMP-IMPA Native Terminal UI Dashboard & Real-Time Observer`](_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md)
> - **ADR:** [`ADR-003: Native TypeScript Terminal UI Engine dengan Zero-Dependency ANSI Renderer`](_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `F-05`)

---

<frozen-after-approval reason="human-owned intent — dilarang diubah agen/dev/review kecuali manusia menegosiasi ulang">

## Intent

**Problem:** Modul-modul data, visual, dan stream perlu diintegrasikan ke dalam satu loop interaktif yang merespons ketukan tombol keyboard (`raw mode`), dapat diluncurkan langsung melalui perintah CLI `ompimpa tui`, dan menjamin pembersihan terminal saat keluar agar sesi shell pengguna tidak rusak.

**Approach:** Bangun controller utama di `src/tui/index.ts` dan daftarkan perintah `tui` pada `src/cli.ts`. Implementasikan event loop non-blocking (50ms render tick), handler masukan keyboard (`↑`, `↓`, `Tab`, `t`, `r`, `q`), penanganan sinyal `SIGWINCH` dan `SIGINT`, serta pemulihan terminal otomatis (*restore main buffer, cursor on, raw mode off*).

## Boundaries & Constraints

**Always:**
- Terminal wajib dipulihkan ke keadaan semula (kursor tampak, alternate screen dimatikan, raw-mode dinonaktifkan) saat keluar normal (`q`), sinyal interupsi (`SIGINT`/`SIGTERM`), maupun bila terjadi uncaught error.
- Perintah CLI `ompimpa tui` wajib mendukung flag `--dir <path>` untuk memantau repositori proyek yang berbeda dari direktori kerja aktif.
- 100% Kriteria Penerimaan (§2) terikat ke asersi otomatis di `test/tui_cli.test.ts`.

**Never:**
- Dilarang membiarkan terminal terjebak dalam raw-mode saat proses berhenti.

</frozen-after-approval>

---

## 0. Open Questions (Gerbang Siap-Kembang)

_Tidak ada pertanyaan terbuka. Siap untuk ATDD Fase Merah._

---

## 1. Ringkasan Cerita (Story Overview)

Story ini menyatukan seluruh bagian arsitektur TUI menjadi satu kesatuan yang dapat dioperasikan pengguna. Mengadopsi key bindings dari `_upstream/bmad-loop/src/bmad_loop/tui/screens/dashboard.py`:
- `q` atau `Ctrl+C`: Keluar bersih dari TUI.
- `↑` / `k`: Memindahkan kursor pemilihan cerita ke atas.
- `↓` / `j`: Memindahkan kursor pemilihan cerita ke bawah.
- `Tab`: Mengganti tab panel kanan (*Live Activity* $\leftrightarrow$ *Test Logs* $\leftrightarrow$ *Spec*).
- `t`: Menyalakan/mematikan visibilitas alur penalaran model (*thinking toggle*).
- `r`: Memaksa rescan dan redraw seketika.

Integrasi ini menambahkan entri bantuan pada `src/cli.ts`:
```
  tui       Launch interactive terminal monitoring dashboard for active ompimpa loops
```

---

## 2. Kriteria Penerimaan (Acceptance Criteria)

### AC-F05-1: Keyboard Navigation State Transitions
- **Given:** Antarmuka TUI aktif dengan $N$ daftar cerita.
- **When:** Pengguna menekan tombol `ArrowDown` (atau `j`), kursor aktif berpindah ke cerita berikutnya; saat `ArrowUp` (atau `k`) ditekan, kursor berpindah ke cerita sebelumnya.

### AC-F05-2: Cyclical Tab Switching via Tab Key
- **Given:** Tab aktif berada pada "activity".
- **When:** Tombol `Tab` ditekan berurutan.
- **Then:** Tab berganti siklikal: `"activity"` $\to$ `"test_logs"` $\to$ `"spec"` $\to$ `"activity"`.

### AC-F05-3: Terminal Restoration & Hygiene Guarantee
- **Given:** TUI sedang aktif dalam alternate screen buffer dan raw mode.
- **When:** Pengguna menekan `q`, atau proses menerima `SIGINT` (Ctrl+C).
- **Then:** Controller mengeksekusi `cleanup()`, mengembalikan mode terminal normal, menampilkan kembali kursor teks (`\x1b[?25h`), dan keluar dengan exit code 0.

### AC-F05-4: CLI Target Discovery & Launch
- **Given:** Perintah `ompimpa tui --dir /path/to/project` dijalankan.
- **When:** Parameter CLI diparsing oleh `src/cli.ts`.
- **Then:** Target direktori tervalidasi memuat struktur `_ompimpa/` dan meluncurkan controller TUI dengan path tersebut.

---

## 3. Antarmuka Teknis & Signature API (`src/tui/index.ts`)

```typescript
export interface TuiOptions {
  targetDir?: string;
  fps?: number;
  showThinking?: boolean;
}

export class TuiController {
  constructor(private options: TuiOptions);
  start(): Promise<void>;
  stop(): void;
  handleInput(key: string): void;
  render(): void;
  cleanup(): void;
}

export async function runTui(options: TuiOptions): Promise<void>;
```

---

## 4. Matriks Risiko & Rencana Pengujian (TEA-01 Traceability)

| Kode AC | Kategori Risiko | Target Pengujian | File Pengujian |
|---|---|---|---|
| **AC-F05-1** | P1 (UX Navigation) | Arrow key selection boundary math | `test/tui_cli.test.ts` |
| **AC-F05-2** | P1 (UX Navigation) | Tab key cyclical state transition | `test/tui_cli.test.ts` |
| **AC-F05-3** | P0 (Terminal Safety) | Strict cleanup execution on exit/signal | `test/tui_cli.test.ts` |
| **AC-F05-4** | P1 (CLI Integration) | CLI argv routing and target resolution | `test/tui_cli.test.ts` |

---

## 5. Target Files

- `src/tui/index.ts` *(berkas baru)*
- `src/cli.ts` *(modifikasi untuk menambahkan handler tui)*
- `test/tui_cli.test.ts` *(berkas baru)*

---

## 6. Kill Criteria

- Jika terminal tidak mendukung mode interaktif TTY (`!process.stdin.isTTY`), CLI wajib keluar dengan pesan galat ramah: *"Error: ompimpa tui requires an interactive TTY terminal."* tanpa melempar stacktrace kotor.

---

## 7. Riwayat Review & Scorecard

### Review ATDD & Implementation (2026-09-09)
- **Tests:** `test/tui_cli.test.ts` (7 pass, 0 fail, 19 assertions)
- **AC Traceability:**
  - AC-F05-1 (Keyboard Navigation State Transitions): PASS (100%)
  - AC-F05-2 (Cyclical Tab Switching via Tab Key): PASS (100%)
  - AC-F05-3 (Terminal Restoration & Hygiene Guarantee): PASS (100%)
  - AC-F05-4 (CLI Target Discovery & Launch): PASS (100%)
- **Skor TEA:** 100/100 (Pass Quality Gate)
