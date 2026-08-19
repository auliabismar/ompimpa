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
1. File fisik `docs/status/feature-status.yaml` (atau `sprint-status.yaml`) dicatat di disk dan di-commit ke Git.
2. Saat perintah `/ompimpa:dev` dipanggil di sesi baru, agen cukup membaca berkas YAML tersebut dan langsung melanjutkan tepat di story yang berstatus `ready-for-dev`.

---

## 2. Mengapa Proteksi Circuit Breaker Wajib (*Token Loss Prevention*)?

Dalam rekayasa otonom, ada risiko model AI mencoba memperbaiki bug yang sama berulang-ulang tanpa sadar bahwa ia menemui jalan buntu (*infinite fix loop*). Hal ini dapat menghabiskan ribuan token dalam hitungan menit tanpa hasil.

### Mekanisme Circuit Breaker OMP-IMPA:
1. Parameter `max_dev_retries = 3` di `ompimpa.toml` menetapkan batas maksimal perulangan perbaikan untuk satu tes/story.
2. Jika kegagalan terjadi 3 kali berturut-turut:
   - Loop otomatis **seketika diputus (*tripped*)**.
   - Agen berhenti memodifikasi kode.
   - Agen mengumpulkan seluruh log kesalahan dan meminta panduan manusia melalui dialog interaktif `ask`.
3. Hal ini menjamin bahwa sistem tetap terkendali (*Human-in-the-Loop*) dan mencegah regresi liar.

---

## 3. Manajemen Sumber Daya Mesin & Konkurensi (`[resources]`)

Alih-alih memaksakan nilai konstan yang kaku (*hardcoded*), alokasi beban komputasi diatur langsung melalui blok `[resources]` di `ompimpa.toml`:

```toml
[resources]
max_concurrency = 2              # Batas subagent paralel yang aktif bersamaan (sesuaikan dengan core CPU/RAM)
use_git_worktrees = true         # Mengisolasi pengerjaan di folder ~/.omp/wt/
shared_lsp_server = true         # Berbagi 1 instance ElixirLS untuk seluruh agen
```

### Manfaat Pengaturan Ini:
- **Di Laptop / Mesin Ringan (RAM 8–16 GB)**: Atur `max_concurrency = 2` untuk menjaga sistem tetap dingin dan bebas dari *Out of Memory (OOM)* crash.
- **Di Server / Workstation Kuat (32+ Core, 64+ GB RAM)**: Naikkan `max_concurrency = 8` untuk mempercepat penyelesaian satu Epic raksasa secara paralel.
- **Isolasi Folder Kerja**: Mencegah race condition dan file lock pada folder kompilasi `_build/`.
