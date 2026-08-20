# How-To: Menjalankan Loop Eksekusi Koding Otonom (`/ompimpa:dev`)

Panduan ini menjelaskan cara menjalankan siklus implementasi otonom berbasis state di disk (`_ompimpa/status/feature-status.yaml`), prinsip pengujian terfokus (*Scoped Testing*), peran OMP Guard Hook dalam menjaga kelanjutan loop, dan penanganan *circuit breaker*.

---

## 1. Menjalankan Dev Loop Tunggal

Untuk mengerjakan satu slice berikutnya yang siap dikerjakan:

```bash
/ompimpa:dev
```

### Siklus Tertutup yang Berjalan:
1. **Baca State di Disk**: Mengambil story dengan `status: ready-for-dev` dari `_ompimpa/status/feature-status.yaml`.
2. **Verifikasi Tes Merah (Scoped Test)**:
   Mengeksekusi pengujian terfokus hanya pada berkas tes slice aktif (misal: `mix test test/my_app_web/live/passkey_live_test.exs`) untuk memastikan tes berstatus FAIL secara valid.
   > **Penting**: Hindari menjalankan `mix test` global tanpa argumen di fase ini agar loop koding tetap cepat (< 2 detik per iterasi).
3. **Koding Spesialis**: Mengedit kode di Git Worktree terisolasi hingga seluruh asersi tes berstatus HIJAU.
   - Jika terjadi kegagalan dengan stacktrace panjang, OMP Guard Hook (`hooks/ompimpa-guard.ts`) otomatis memangkas boilerplate trace internal untuk menghemat token konteks.
4. **Macro-Review & Triage**: Menjalankan panel review 4-jalur:
   - Jika ada temuan **P0 (Blocker)** atau **P1 (Warning)**: Sistem otomatis memprioritaskan perbaikan (*triage*), mengeksekusi kode remediasi, dan menjalankan **Re-Review**.
   - Temuan **P2 (Suggestion)** dicatat ke `_ompimpa/status/` tanpa memblokir penyelesaian story.
5. **Git Commit & Status Sync**:
   - Melakukan git commit yang diverifikasi secara instan oleh **Fast Pre-Commit Gate** (diff scan + strict incremental compile + format).
   - Mengubah status story di `_ompimpa/status/feature-status.yaml` menjadi `status: done`.

---

## 2. Menjalankan Mode Otomatis Penuh (`--auto`)

Untuk menyelesaikan seluruh slice dalam satu inisiatif tanpa intervensi manual:

```bash
/ompimpa:dev --auto
```

### Mekanisme Otonom OMP Hook (`session_stop`):
* Saat satu story selesai dan sesi hendak berhenti, hook OMP `session_stop` otomatis membaca `_ompimpa/status/feature-status.yaml`.
* Jika masih ditemukan story dengan status `ready-for-dev` atau `in-progress`, hook menginstruksikan agent untuk melanjutkan (`continue: true`) ke story berikutnya secara rekursif hingga seluruh roadmap tuntas.

---

## 3. Penanganan Kebuntuan (*Circuit Breaker*)

Jika sebuah slice gagal tes atau gagal review sebanyak **3 kali berturut-turut** (diatur via `max_dev_retries = 3` di `ompimpa.toml`):
1. **Loop Otomatis Berhenti**: Sistem memutus loop (*circuit breaker trip*) untuk mencegah pemborosan token dan loop tak berujung.
2. **Eskalasi ke Manusia**: Agen menampilkan ringkasan kendala teknis dan meminta keputusan Anda via dialog interaktif `ask`.
3. Setelah Anda memberikan arahan atau melakukan perbaikan manual, jalankan kembali `/ompimpa:dev` untuk melanjutkan.
