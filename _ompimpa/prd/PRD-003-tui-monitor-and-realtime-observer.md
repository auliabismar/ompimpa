# PRD-003: OMP-IMPA Native Terminal UI (TUI) Dashboard & Real-Time Observer

> **Status:** Draft — Ready for Implementation  
> **Versi:** 1.0.0  
> **Tanggal:** 2026-09-09  
> **Owner:** H. Agus Salim (`ompimpa-prd`) — Dewan Balairung Sari  
> **SSOT Rujukan:** `_upstream/bmad-loop/src/bmad_loop/tui/` (`app.py`, `data.py`, `widgets.py`, `screens/dashboard.py`)  
> **Rujukan Arsitektur:** `_ompimpa/adr/ADR-003-native-typescript-terminal-ui.md`, `_ompimpa/stories.yaml` (EPIC-F)  
> **Stack:** TypeScript 5.x · Bun Runtime · ANSI/VT100 Native · Zero External npm Dependencies

---

## 1. Ringkasan Eksekutif

Menindaklanjuti ketetapan **ADR-003**, PRD ini menetapkan spesifikasi fungsional dan teknis untuk menghadirkan antarmuka pemantauan interaktif terminal (**TUI Dashboard**) pada ekosistem OMP-IMPA. 

Selama eksekusi otonom `ompimpa dev`, operator membutuhkan visibilitas seketika (*real-time observability*) terhadap:
1. Aliran aksi nyata sub-agen `omp` (*tool calls*: `bash`, `edit`, `read`, `write`) beserta keluaran hasilnya.
2. Alur penalaran model (*thinking / chain-of-thought*) yang dapat di-toggle.
3. Progres Kanban dan pohon cerita (*Stories DAG*) dari status `ready-for-atdd` hingga `done`.
4. Log kompilasi dan uji ATDD (`mix test`) tanpa harus membuka banyak tab terminal terpisah.

Mengambil **`bmad-loop tui`** sebagai *Single Source of Truth* (SSOT) konseptual, implementasi ini diwujudkan secara **100% native di atas Bun dan TypeScript** tanpa membawa ketergantungan Python, Textual, atau pustaka berat node_modules.

---

## 2. Ruang Lingkup (Scope vs Non-Goals)

### In Scope
1. **Stat-Gated State & Session Tailer (`src/tui/data.ts`):**
   - Pemantauan berkas `_ompimpa/status/feature-status.yaml` dan `stories.yaml` dengan stat-cache `(mtime, size)` untuk mencegah disk I/O berlebihan.
   - Pembacaan inkremental unbuffered berkas stream JSONL `~/.omp/agent/sessions/-<project>/*.jsonl` dengan *line-boundary guard* (menolak parse parsial sebelum karakter `\n`).
   - Ekstraksi event terstruktur: `toolCall`, `toolResult`, `thinking`, `text`, dan `phase_transition`.
2. **ANSI Box-Drawing & Responsive Layout Engine (`src/tui/terminal.ts`):**
   - Perhitungan dimensi terminal interaktif (`process.stdout.columns` & `rows`).
   - Box border rendering (`┌─┐│└─┘├┤┬┴┼`), pewarnaan ANSI 16/256-color, dan pengukuran teks (*visible string length stripping escape codes*).
   - Penanganan sinyal ukuran terminal (`SIGWINCH`) dengan *debounce redraw* < 50ms.
3. **Pohon Cerita & Kanban Pane (`src/tui/panes/stories.ts`):**
   - Menampilkan glif status (`▶` in-progress, `✔` done, `⏳` backlog, `✖` failed, `⏸` paused).
   - Menampilkan prioritas dan *TEA Tier* (`P0`, `P1`, `P2`), hitungan *retries*, dan kartu detail story aktif (Intent, Target Files, AC).
4. **Live Activity Stream & Multi-Tab Viewer (`src/tui/panes/stream.ts`):**
   - Tab 1 (**Live Activity**): Badge aksi berwarna (`⚡ [BASH]`, `✏️ [EDIT]`, `📖 [READ]`, `📝 [WRITE]`).
   - Toggle penalaran (*thinking*) menggunakan hotkey `t`.
   - Tab 2 (**Test Logs**): Live tailing berkas `tmp/test-logs/mix-test-*.log`.
   - Tab 3 (**Micro Spec**): Inspeksi kontrak `_ompimpa/specs/SPEC-<id>.md`.
5. **CLI Subcommand & Raw-Mode Hygiene (`src/tui/index.ts`, `src/cli.ts`):**
   - Integrasi perintah `ompimpa tui [--dir <path>] [--fps <n>]`.
   - Manajemen terminal *raw-mode* aman: restorasi buffer normal (`\x1b[?1049l`), kursor terlihat (`\x1b[?25h`), dan penanganan `SIGINT` / `SIGTERM` bersih.

### Non-Goals (Out of Scope)
- Membangun antarmuka berbasis web/GUI Electron/browser (fokus 100% pada TUI terminal).
- Mengontrol atau menghentikan eksekusi sub-agen secara destruktif dari TUI pada iterasi awal (TUI bersifat *pure observer* read-only).
- Membawa ketergantungan runtime Python, pip, atau uv ke dalam repositori `ompimpa`.

---

## 3. Matriks Kebutuhan Fungsional (Functional Requirements)

| ID | Kebutuhan Fungsional | Komponen Teknis | Acceptance Criteria Gherkin |
|---|---|---|---|
| **FR-TUI-01** | *Stat-Gated State Reader* | `src/tui/data.ts` | **Given** repositori proyek dengan `_ompimpa/status/feature-status.yaml`, **When** `loadState()` dipanggil berulang kali tanpa perubahan berkas, **Then** pembacaan mengembalikan cache memori tanpa operasi read disk baru. |
| **FR-TUI-02** | *Incremental JSONL Stream Parser* | `src/tui/data.ts` | **Given** sub-agen menulis stream JSONL ke disk secara bertahap, **When** tailing membaca baris yang belum selesai ditulis (tanpa `\n`), **Then** parser tidak mengalami crash dan menunggu baris tuntas sebelum diproses. |
| **FR-TUI-03** | *ANSI Layout & Box Border Engine* | `src/tui/terminal.ts` | **Given** terminal berukuran $\ge 80 \times 24$, **When** layout dirender, **Then** seluruh kotak border `┌─┐│└─┘` sejajar rapi tanpa tumpang tindih teks atau wrapping liar. |
| **FR-TUI-04** | *ANSI-Aware Truncation & Measurement* | `src/tui/terminal.ts` | **Given** string yang memuat escape code warna ANSI, **When** teks dipotong sesuai batas lebar kolom, **Then** pemotongan memperhitungkan panjang visual dan menutup kode warna (`\x1b[0m`). |
| **FR-TUI-05** | *Kanban Status Glyphs & Story Card* | `src/tui/panes/stories.ts` | **Given** daftar cerita di `feature-status.yaml`, **When** dirender di panel kiri, **Then** menampilkan glif status yang tepat (`▶`, `✔`, `⏳`, `✖`) beserta tier TEA (`P0`/`P1`/`P2`). |
| **FR-TUI-06** | *Tool Call Action Stream & Badges* | `src/tui/panes/stream.ts` | **Given** event `toolCall` pada sesi aktif, **When** event diproses, **Then** antarmuka menampilkan label badge spesifik: `⚡ BASH`, `✏️ EDIT`, `📖 READ`, `📝 WRITE` dengan warna berbeda. |
| **FR-TUI-07** | *Thinking / Chain-of-Thought Toggle* | `src/tui/panes/stream.ts` | **Given** log stream memuat blok `thinking`, **When** pengguna menekan tombol `t`, **Then** tampilan berganti antara menyembunyikan atau menampilkan alur penalaran model. |
| **FR-TUI-08** | *Tabbed Panel Switching* | `src/tui/panes/stream.ts` | **Given** panel kanan aktif, **When** pengguna menekan tombol `Tab`, **Then** tampilan berpindah antara Live Activity, Test Logs, dan Spec View. |
| **FR-TUI-09** | *Keyboard Navigation in Raw Mode* | `src/tui/index.ts` | **Given** TUI sedang aktif, **When** tombol `↑` atau `↓` ditekan, **Then** kursor pemilihan story berpindah dan memperbarui detail kartu story. |
| **FR-TUI-10** | *Terminal Restoration Hygiene* | `src/tui/index.ts` | **Given** TUI aktif di alternate screen buffer, **When** pengguna menekan `q` atau mengirim sinyal `SIGINT`, **Then** terminal kembali normal, kursor dimunculkan, dan raw mode dinonaktifkan. |
| **FR-TUI-11** | *CLI Subcommand & Auto-Discovery* | `src/cli.ts` | **Given** perintah `ompimpa tui` dijalankan dari direktori proyek, **When** dieksekusi, **Then** CLI mendeteksi folder `_ompimpa` dan meluncurkan dashboard secara instan. |

---

## 4. Kebutuhan Non-Fungsional (Non-Functional Requirements)

1. **Latensi Render (NFR-01):** Waktu gambar ulang (*render frame*) tidak boleh melebihi **50 milidetik** pada terminal standar WSL/Linux/macOS.
2. **Jejak Memori (NFR-02):** Konsumsi memori proses TUI tidak boleh melebihi **35 MB RSS**.
3. **Zero Dependencies (NFR-03):** Dilarang menambahkan dependensi pihak ketiga baru ke dalam `package.json` (kecuali dependensi `yaml` yang sudah ada). Seluruh rendering menggunakan VT100 / ANSI escape sequences native.
4. **Resilience & Non-Blocking I/O (NFR-04):** Operasi I/O berkas dan pembacaan stream log tidak boleh memblokir *event loop* pembacaan tombol keyboard.
5. **Graceful Degradation (NFR-05):** Jika terminal berukuran $< 70 \times 20$, TUI menampilkan pesan peringatan singkat meminta pembesaran jendela alih-alih melempar exception crash.

---

## 5. Rincian Epics & Stories Breakdown (EPIC-F)

- **`F-01` (P0 - Foundation):** *Stat-Gated State Reader & Active Session Tailer*  
  Membaca dan mem-parsing berkas status, spesifikasi, dan *incremental tail* sesi JSONL sub-agen.
- **`F-02` (P0 - Visual/UI):** *ANSI Box-Drawing, Text Measurement & Split-Pane Layout Engine*  
  Mesin tata letak terminal responsif, kalkulasi kolom ANSI-aware, dan *box drawing*.
- **`F-03` (P0 - Presentation):** *Story Kanban & Active Contract Inspector Pane*  
  Visualisasi status cerita, glif kanban, metrik TEA tier, dan kartu inspeksi kriteria penerimaan.
- **`F-04` (P0 - Stream):** *Live Event Stream, Test Log Viewer & Thinking Toggle*  
  Format badge aksi sub-agen, live log uji Elixir, dan toggle interaktif alur penalaran model.
- **`F-05` (P1 - DX):** *CLI Integration (`ompimpa tui`), Raw-Mode Navigation & Lifecycle Hygiene*  
  Penanganan navigasi keyboard, auto-discovery target direktori, dan restorasi buffer terminal bersih.

---

*Disahkan oleh Dewan Balairung Sari & H. Agus Salim — BMM Product Governance OMP-IMPA*
