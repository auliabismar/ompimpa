# ADR-003: Native TypeScript Terminal UI (TUI) Dashboard Engine dengan Zero-Dependency ANSI Renderer

> **Status:** Accepted — 2026-09-09  
> **Deciders:** Dewan Balairung Sari (Tan Malaka, H. Agus Salim, Hj. Rasuna Said, Sutan Sjahrir, Tuanku Imam Bonjol, Bung Hatta, Djamaluddin Adinegoro, Marah Rusli) & Ketua Sidang  
> **Rujukan:** `_ompimpa/prd/PRD-003-tui-monitor-and-realtime-observer.md`, `_upstream/bmad-loop/src/bmad_loop/tui/`  
> **Tags:** `tui`, `terminal-ui`, `observability`, `ansi`, `bun`, `typescript`, `zero-dependencies`, `MADR-3.0`  
> **Supersedes:** Bagian TUI Non-Goal pada `PRD-002` / `ADR-002`  
> **Amends:** `_ompimpa/stories.yaml` (Menambahkan `EPIC-F`), `src/cli.ts` (Menambahkan subcommand `tui`)

---

## 1. Context and Problem Statement

Pada implementasi siklus otonom OMP-IMPA (`ompimpa dev --epic <ID> --auto`), sub-agen `omp` mengeksekusi tahapan koding, kompilasi, eksekusi tes `mix test`, dan review 7-jalur di latar belakang. Operator saat ini mengalami kesenjangan observabilitas (*observability gap*):

1. **Ketiadaan Visibilitas Seketika:** Operator tidak dapat melihat secara transparan apakah sub-agen sedang membaca berkas, menulis kode, menjalankan kompilasi, atau menunggu respons pengujian kecuali dengan membuka terminal terpisah dan menjalankan skrip manual.
2. **Ketergantungan Legacy Upstream (`bmad-loop`):** Upstream `bmad-loop` menyediakan perintah `bmad-loop tui` yang sangat baik secara konseptual, namun diimplementasikan menggunakan Python (Textual, Rich, Pyte) yang memerlukan virtualenv, puluhan paket pip/uv, dan hanya mengenali struktur direktori lama `.bmad-loop/runs/`.
3. **Konflik Runtime Stack:** Memaksa dependensi Python ke dalam repositori OMP-IMPA yang murni berbasis Bun & TypeScript merupakan pelanggaran prinsip kebersihan arsitektur (*architectural hygiene*).

Dibutuhkan mekanisme dashboard TUI pemantau yang interaktif, berkinerja tinggi, dan terintegrasi langsung ke dalam CLI `ompimpa`.

---

## 2. Decision Drivers

* **D1 — Ekosistem Asli Bun & TypeScript:** Seluruh komponen pemantauan harus berjalan di atas runtime Bun tanpa memerlukan instalasi Python 3, uv, atau pip pada mesin developer.
* **D2 — Zero External npm Dependencies:** Menghindari beban *supply chain* dan kompleksitas dependensi baru; antarmuka terminal harus dapat dirender menggunakan escape codes ANSI/VT100 standar.
* **D3 — Paritas Fitur Terhadap Upstream SSOT (`bmad-loop tui`):** Mengadopsi prinsip desain teruji dari `bmad-loop tui` (stat-gated caching, pembacaan inkremental unbuffered stream JSONL, layout split-pane, glif status kanban, dan hotkey interaktif).
* **D4 — Latensi Rendah & Konsumsi Memori Minimal:** Waktu startup di bawah 30 ms dan konsumsi memori di bawah 35 MB RSS agar tidak membebani workstation yang sedang menjalankan kompilasi BEAM/Elixir.
* **D5 — Terminal Lifecycle Hygiene:** Wajib membersihkan *raw mode*, memulihkan kursor, dan beralih kembali dari *alternate screen buffer* saat keluar atau menerima sinyal terminasi (`SIGINT`/`SIGTERM`).

---

## 3. Considered Options

### Opsi A — Menjalankan Wrapper Python `bmad-loop tui` via Subprocess
Membuat perintah `ompimpa tui` yang bertindak sebagai adaptor untuk memanggil `/home/aulia/.local/bin/bmad-loop tui` dan menerjemahkan `_ompimpa/` ke `.bmad-loop/`.
* **Kontra:**
  - Bergantung pada keberadaan Python 3.12+ dan Textual di workstation.
  - Memerlukan *symlink* atau konversi berkas runtime dua arah yang rentan *race conditions*.
  - Menambah jejak memori ganda (Bun process + Python Textual process ~120MB).

### Opsi B — Menggunakan Pustaka TUI Node.js Pihak Ketiga (Ink / Blessed / Terminal-Kit)
Memasang dependensi npm seperti `ink` (React-based terminal UI) atau `blessed`.
* **Kontra:**
  - `ink` menarik dependensi React, Yoga layout engine (C++ bindings), dan ratusan sub-dependensi ke `package.json`.
  - `blessed` sudah tidak dipelihara secara aktif dan sering mengalami *rendering artifact* pada terminal modern seperti Zed terminal atau Windows Terminal WSL2.
  - Memperlambat waktu startup CLI.

### Opsi C — **Native TypeScript Terminal UI Engine dengan ANSI VT100 Renderer (Dipilih)**
Membangun modul mandiri di `src/tui/` menggunakan API standar Bun (`process.stdout`, `process.stdin.setRawMode`) dan ANSI escape sequences murni:
1. `src/tui/data.ts`: Stat-gated file reader dan unbuffered JSONL stream parser.
2. `src/tui/terminal.ts`: Mesin tata letak box border (`┌─┐│└─┘`), ANSI string measurement & truncation.
3. `src/tui/panes/`: Komponen render untuk Stories Kanban, Live Activity Stream, Test Logs, dan Micro Spec.
4. `src/tui/index.ts`: Controller navigasi keyboard dan *lifecycle management*.

---

## 4. Decision Outcome

**Dipilih Opsi C.**

### 1. Arsitektur Komponen TUI
```
┌─────────────────────────────────────────────────────────────┐
│                       CLI: ompimpa tui                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
     [src/tui/data.ts]               [src/tui/terminal.ts]
   - Stat-gated reader             - Alternate screen buffer
   - Incremental JSONL tailer      - ANSI box drawing & colors
   - Process liveness detector     - SIGWINCH resize listener
               │                               │
               └───────────────┬───────────────┘
                               ▼
                     [src/tui/index.ts]
               - Event Loop (50ms render tick)
               - Raw-mode keyboard handler
               - Component Panes:
                 • Stories Kanban Pane
                 • Live Activity & Thinking Stream
                 • Test Log & Spec Inspector
```

### 2. Invarian Arsitektur & Prinsip Operasi
1. **Pure Read-Only Observer:** Komponen TUI dilarang menulis ke berkas *state* (`stories.yaml`, `feature-status.yaml`, atau berkas kode aplikasi). Hak tulis hanya dimiliki oleh `loop_runner`.
2. **Stat-Gating Invariant:** Pembacaan berkas status wajib memeriksa `(mtime, size)`. Jika tidak ada perubahan, TUI menggunakan snapshot memori sebelumnya.
3. **Incremental Line Boundary Guard:** Tailer JSONL wajib melacak posisi *byte offset* dan hanya mem-parsing baris yang diakhiri karakter `\n` untuk mencegah galat `JSON.parse` pada data yang sedang ditulis parsial oleh `omp`.
4. **Clean Exit Assurance:** Registrasi handler `process.on("exit")`, `process.on("SIGINT")`, dan `process.on("SIGTERM")` yang mengeksekusi pembersihan terminal:
   ```typescript
   process.stdout.write("\x1b[?25h\x1b[?1049l"); // show cursor, restore main buffer
   process.stdin.setRawMode(false);
   ```

---

## 5. Pros and Cons of the Options

### Opsi C (Native TypeScript ANSI Engine)
* **Kelebihan:**
  - **Zero New Dependencies:** Tetap mempertahankan kesederhanaan `package.json`.
  - **Super Cepat:** Startup < 25ms, penggunaan memori < 30MB RSS.
  - **Portabilitas Tinggi:** Bekerja sempurna di WSL2, Linux terminal, macOS, dan SSH sessions.
  - **Kontrol Penuh:** Kemampuan memfilter dan menata tampilan *thinking stream*, perintah *bash*, dan pengujian secara spesifik sesuai kebutuhan OMP-IMPA.
* **Kekurangan:**
  - Perlu mengelola pemotongan teks (*string width calculation*) secara mandiri terhadap kode escape ANSI (diatasi dengan helper regex pembersih kode kontrol).

---

## 6. Rencana Implementasi (EPIC-F Stories)

1. **`F-01`**: Stat-Gated State Reader & Active Session Tailer (`src/tui/data.ts`)
2. **`F-02`**: ANSI Terminal Box & Layout Engine (`src/tui/terminal.ts`)
3. **`F-03`**: Story Kanban & Active Contract Inspector Pane (`src/tui/panes/stories.ts`)
4. **`F-04`**: Live Event Stream Viewer & Thinking Toggle (`src/tui/panes/stream.ts`)
5. **`F-05`**: CLI Subcommand Integration, Keyboard Navigation & Cleanup (`src/tui/index.ts`, `src/cli.ts`)

---

*Disahkan oleh Dewan Balairung Sari & H. Agus Salim — MADR 3.0+*
