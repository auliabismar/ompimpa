# How-To: Menyusun Panduan Diátaxis untuk User, Admin, dan Developer

Panduan ini menjelaskan cara menggunakan subagent `ompimpa-doc` (Mohammad Yamin) untuk menghasilkan dokumentasi terstruktur berstandar 4 kuadran Diátaxis langsung dari PRD, Epic, Story, dan kode sumber riil.

---

## 1. Menghasilkan Panduan Pengguna (User's Guide)

Untuk membuat panduan alur kerja bagi pengguna akhir berdasarkan fitur di Epic atau Story tertentu:

```bash
/ompimpa:doc user --epic 8
```

### Berkas yang Dihasilkan di `docs/user/`:
- **`tutorials/`**: Panduan langkah demi langkah bagi pengguna yang baru pertama kali menggunakan fitur.
- **`how-to/`**: Panduan cara menyelesaikan tugas tertentu (misal: *"Cara Mengaktifkan Autentikasi Biometrik"*).

---

## 2. Menghasilkan Panduan Administrator (Admin's Guide)

Untuk membuat dokumentasi operasional dan tata kelola sistem:

```bash
/ompimpa:doc admin --story 1.2
```

### Berkas yang Dihasilkan di `docs/admin/`:
- **`how-to/`**: Prosedur konfigurasi hak akses, manajemen peran pengguna, dan audit trail.
- **`reference/`**: Variabel environment, daftar role RBAC, dan jadwal antrean cron Oban.

---

## 3. Menghasilkan Panduan Pengembang (Developer's Guide)

Untuk mendokumentasikan modul teknis, arsitektur, dan referensi API:

```bash
/ompimpa:doc dev --module Accounts
```

### Berkas yang Dihasilkan di `docs/dev/`:
- **`reference/`**: Spesifikasi lengkap skema Ecto/Ash Resources, Actions, parameter event LiveView, dan endpoint API.
- **`explanation/`**: Alasan arsitektur di balik perancangan modul, trade-off yang dipilih di ADR, dan 26 Hukum Besi yang relevan.
