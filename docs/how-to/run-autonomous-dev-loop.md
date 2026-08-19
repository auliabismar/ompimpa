# How-To: Menjalankan Loop Eksekusi Koding Otonom (`/ompimpa:dev`)

Panduan ini menjelaskan cara menjalankan siklus implementasi otonom berbasis state di disk (`_ompimpa/status/feature-status.yaml`), siklus tertutup *Review $\rightarrow$ Triage $\rightarrow$ Remediasi $\rightarrow$ Re-Review*, dan penanganan circuit breaker.

---

## 1. Menjalankan Dev Loop Tunggal

Untuk mengerjakan satu slice berikutnya yang siap dikerjakan:

```bash
/ompimpa:dev
```

### Siklus Tertutup yang Berjalan:
1. **Baca State di Disk**: Mengambil story dengan `status: ready-for-dev` dari `_ompimpa/status/feature-status.yaml`.
2. **Verifikasi Tes Merah**: Memastikan file tes ATDD gagal secara valid.
3. **Koding Spesialis**: Mengedit kode di Git Worktree terisolasi hingga seluruh tes berstatus HIJAU.
4. **Macro-Review & Triage**: Menjalankan panel review 4-jalur:
   - Jika ada temuan **P0 (Blocker)** atau **P1 (Warning)**: Sistem otomatis memprioritaskan tugas perbaikan (*triage*), mengeksekusi perbaikan kode, dan menjalankan **Re-Review** untuk memvalidasi bahwa perbaikan berhasil tanpa memicu regresi.
   - Temuan **P2 (Suggestion)** dicatat ke `_ompimpa/status/` tanpa memblokir penyelesaian story.
5. **Git Commit & Status Sync**: Melakukan commit otomatis dan menandai story sebagai `status: done` di file disk.

---

## 2. Menjalankan Mode Otomatis Penuh (`--auto`)

Untuk menyelesaikan seluruh slice dalam satu inisiatif tanpa henti:

```bash
/ompimpa:dev --auto
```

Agen akan mengeksekusi siklus *Red $\rightarrow$ Green $\rightarrow$ Review $\rightarrow$ Triage $\rightarrow$ Fix $\rightarrow$ Re-Review $\rightarrow$ Commit* untuk setiap story secara berurutan.

---

## 3. Penanganan Kebuntuan (*Circuit Breaker*)

Jika sebuah slice gagal tes atau gagal review sebanyak **3 kali berturut-turut** (diatur via `max_dev_retries = 3` di `ompimpa.toml`):
1. **Loop Otomatis Berhenti**: Sistem memutus loop (*circuit breaker trip*) untuk mencegah pemborosan token.
2. **Eskalasi ke Manusia**: Agen menampilkan ringkasan kendala teknis dan meminta keputusan Anda via dialog interaktif `ask`.
3. Setelah Anda memberikan arahan, jalankan kembali `/ompimpa:dev` untuk melanjutkan.
