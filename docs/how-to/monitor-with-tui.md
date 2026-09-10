# How-To: Memantau Eksekusi Dev Loop dengan Terminal UI Monitor (`ompimpa tui`)

Panduan berorientasi tugas (*Task-Oriented*) ini menjelaskan cara memantau aktivitas loop rekayasa otonom, progres kanban stories, dan keluaran subagent secara real-time menggunakan antarmuka terminal interaktif **`ompimpa tui`** (EPIC-F).

---

## 1. Menjalankan Monitor TUI

Buka terminal terpisah di direktori proyek Phoenix Anda (atau arahkan ke folder yang memiliki `_ompimpa/`):

```bash
# Jalankan monitor TUI interaktif
ompimpa tui

# Opsi: tampilkan thinking buffer subagent sejak awal
ompimpa tui --show-thinking

# Opsi: atur refresh rate render (default 10 FPS)
ompimpa tui --fps 15
```

> 💡 **Arsitektur Tanpa Beban (*Stat-Gated Reader*)**:  
> Mesin `src/tui/data.ts` menggunakan polling `stat()` hemat daya yang hanya membaca ulang berkas disk jika ukuran (*size*) atau stempel waktu modifikasi (*mtime*) berkas berubah. CPU load tetap sub-1% saat sistem idle.

---

## 2. Tata Letak Antarmuka Dual-Pane

Layar monitor terbagi menjadi dua panel utama berbasis ANSI escape sequence murni:

```
┌─  OMP-IMPA Monitor: my_project [OMP-IMPA] | Running  ─────────────────────────────┐
│Target: /path/to/my_project | Session: 2026-09-10T09:30:00Z                        │
└───────────────────────────────────────────────────────────────────────────────────┘
┌─ 📋 Kanban ──────────────┐┌─ 🎯 Detail Kontrak: STORY A-01 ────────────────────────┐
│ [▶️] A-01  in-progress    ││EPIC-A: Governance Spine — 26 Iron Laws 1:1           │
│ [⏳] A-02  ready-for-atdd │├─ [1. Live Activity]  2. Test Logs   3. Micro Spec  ...┤
│ [⏳] A-03  backlog        ││ • [16:40:02] [read] Reading lib/accounts.ex          │
│                          ││ • [16:40:05] [edit] Applying changes to accounts.ex   │
│                          ││ • [16:40:12] [bash] mix test test/accounts_test.exs   │
└──────────────────────────┘└───────────────────────────────────────────────────────┘
 [q] Keluar  [↑/↓/j/k] Pilih Story  [Tab] Ganti Tab  [t] Toggle Thinking  [r] Refresh
```

### A. Panel Kiri — Kanban Stories
Menampilkan daftar seluruh story dari `_ompimpa/stories.yaml` beserta status terkini dari `_ompimpa/status/feature-status.yaml`:
* `✅ done`: Story telah lulus verifikasi 100/100 dan dicommit.
* `▶️ in-progress`: Story sedang dalam fase implementasi koding atau review aktif.
* `⏳ backlog / ready-for-atdd / ready-for-dev`: Story mengantre dalam urutan topologis DAG.
* `❌ failed / blocked`: Story terhenti oleh circuit breaker atau dependensi belum tuntas.

### B. Panel Kanan — Multi-Tab Activity & Spec
Memuat 3 tab tampilan interaktif:
1. **Live Activity**: Jejak *stream activity* langsung dari sesi agent yang sedang berjalan (`~/.omp/agent/sessions/`). Tool call seperti `read`, `edit`, `bash`, `task`, dan `todo` diformat dengan badge status berwarna.
2. **Test Logs**: Ringkasan keluaran kompilasi dan log kegagalan pengujian ExUnit terbaru.
3. **Micro Spec**: Tinjauan langsung naskah spesifikasi mikro `_ompimpa/specs/SPEC-[ID].md` memuat target files dan skenario Gherkin ACs.

---

## 3. Navigasi & Pintasan Keyboard

Monitor TUI berjalan dalam mode *raw keyboard input* interaktif:

| Tombol / Pintasan | Aksi |
| :--- | :--- |
| **`↑` / `k`** | Memilih story sebelumnya pada daftar Kanban. |
| **`↓` / `j`** | Memilih story berikutnya pada daftar Kanban. |
| **`Tab`** | Berpindah tab detail kanan: *Live Activity* ➔ *Test Logs* ➔ *Micro Spec*. |
| **`1` / `2` / `3`** | Langsung melompat ke tab spesifik (1: Live, 2: Logs, 3: Spec). |
| **`t`** | *Toggle Thinking*: Menampilkan atau menyembunyikan blok penalaran (*thought buffer*) model. |
| **`r`** | Memaksa penyegaran (*force refresh*) snapshot disk secara instan. |
| **`q` / `Esc` / `Ctrl+C`** | Keluar dari monitor dan mengembalikan buffer terminal normal secara bersih. |
