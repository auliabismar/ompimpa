# Penjelasan: State Persisten, Circuit Breakers, & Manajemen Sumber Daya Mesin

Dokumen penjelasan ini menguraikan mengapa OMP-IMPA mengandalkan **state persisten di disk (`feature-status.yaml`)**, bagaimana **Circuit Breaker** melindungi developer dari pemborosan token, dan bagaimana **manajemen sumber daya RAM & CPU** dikonfigurasikan secara fleksibel.

---

## 1. Mengapa State di Disk Wajib (*Disk-Anchored State*)?

Di lingkungan AI coding agent:
- Sesi chat bisa ditutup sewaktu-waktu oleh developer.
- Jendela konteks (*context window*) model LLM bisa penuh dan memicu kompresi atau restart.
- Jaringan bisa mengalami gangguan.

Jika status pekerjaan (mana story yang selesai, mana yang sedang dikerjakan) hanya disimpan di memori proses, **seluruh konteks pekerjaan akan lenyap saat sesi terputus**.

### Solusi OMP-IMPA:
1. **Master Stories DAG (`_ompimpa/stories.yaml`)**:
   Menyimpan seluruh story sebagai Directed Acyclic Graph (DAG) terurut topologis lengkap dengan relasi dependensi (`blocked_by`), kepemilikan epic, dan *kill criteria* eksplisit (Story A-02).
2. **Feature Status Tracker (`_ompimpa/status/feature-status.yaml`)**:
   Mencatat state real-time per story sesuai `src/status.ts:STATUS_ORDER` (`backlog` → `ready-for-atdd` → `ready-for-dev` → `in-progress` → `in-review` → `done`, plus non-maju `failed`/`blocked`) beserta riwayat jumlah retry. Status actionable (`backlog`, `ready-for-atdd`, `ready-for-dev`, `in-progress`, `in-review`) membuat outer loop terus berjalan.
3. **Penyelarasan Sesi Otomatis**:
   Saat perintah `/ompimpa:dev` dipanggil di sesi baru, agen cukup membaca kedua berkas tersebut, memvalidasi bahwa tidak ada dependensi yang memblokir, dan langsung melanjutkan tepat di story yang siap dikerjakan (*ready-for-dev*).
---

## 2. Mengapa Proteksi Circuit Breaker Wajib (*Token Loss Prevention*)?

Dalam rekayasa otonom, ada risiko model AI mencoba memperbaiki bug yang sama berulang-ulang tanpa sadar bahwa ia menemui jalan buntu (*infinite fix loop*). Hal ini dapat menghabiskan ribuan token dalam hitungan menit tanpa hasil.

### Mekanisme Circuit Breaker Dua Lapis:
1. **Inner Loop / Triage Circuit Breaker (`max_triage_fix_cycles = 3`)**:
   - Jika hasil review menemukan pelanggaran P0 (Blocker) atau P1 (Warning) sehingga skor < 100, agen otomatis masuk ke siklus remediasi.
   - Jika setelah 3 siklus perbaikan skor tetap belum mencapai 100/100 PASS, proses berhenti dan meminta arahan manusia via dialog interaktif `ask` (Story B-05).
2. **Outer Loop Circuit Breaker (`max_dev_retries = 3`)**:
   - Jika sebuah story gagal pada kompilasi atau tes ATDD merah sebanyak 3 kali berturut-turut, loop koding otomatis diputus (*tripped*).
   - Agen menampilkan ringkasan stacktrace terkompaksi dan meminta keputusan developer.
3. **DAG Blocker Circuit**:
   - Story yang memiliki dependensi belum tuntas (`blocked_by`) secara otomatis diblokir dari antrean eksekusi hingga story prasyarat berstatus `done`.
---

## 3. Manajemen Sumber Daya Mesin & Konkurensi (`[resources]`)

Alih-alih memaksakan nilai konstan yang kaku (*hardcoded*), alokasi beban komputasi diatur langsung melalui blok `[resources]` di `ompimpa.toml`:

```toml
[resources]
use_git_worktrees = true         # Mengisolasi pengerjaan di folder ~/.omp/wt/ (satu-satunya kunci [resources] di src/cli.ts:handleInit)
```

### Manfaat Pengaturan Ini:
- **Isolasi Folder Kerja**: Mencegah race condition dan file lock pada folder kompilasi `_build/` via Git Worktrees (`~/.omp/wt/`).
- **Paralelisme**: Konkurensi DAG subagent hingga 32 task paralel di level OMP Engine, bukan via kunci TOML.
