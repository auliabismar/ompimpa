# Tutorial: Memulai dengan OMP-IMPA dalam 15 Menit

Dokumen ini adalah panduan pembelajaran langkah demi langkah (*Tutorial*) untuk menginstal, menginisialisasi, dan menjalankan siklus rekayasa otonom pertama Anda menggunakan **OMP-IMPA** sebagai OMP Plugin pada aplikasi Phoenix.

---

## Prasyarat
Sebelum memulai, pastikan sistem Anda memiliki:
1. **Oh My Pi (`omp`)**: Terpasang dan dapat dijalankan di terminal (`omp --version`).
2. **Bun**: Runtime JavaScript/TypeScript (`bun --version`).
3. **Elixir & Phoenix**: Proyek Phoenix yang aktif dengan `mix.exs`.
4. **Git**: Version control untuk pelacakan kode.

---

## Langkah 1: Pasang Plugin OMP-IMPA ke OMP

Pilih salah satu dari 3 cara instalasi plugin OMP berikut:

### Opsi A: Instalasi Langsung via Git (Direkomendasikan — 1 Perintah)
```bash
omp plugin install github:auliabismar/ompimpa
```

### Opsi B: Instalasi via OMP Marketplace
```bash
# Tambahkan marketplace OMP-IMPA
omp plugin marketplace add auliabismar/ompimpa

# Pasang plugin
omp plugin install ompimpa@ompimpa
```
*Atau dari dalam sesi interaktif OMP:*
```text
/marketplace add auliabismar/ompimpa
/marketplace install ompimpa@ompimpa
```

### Opsi C: Local Link (Untuk Pengembangan Lokal / Kontributor)
```bash
git clone https://github.com/auliabismar/ompimpa.git
cd ompimpa
omp plugin link .
```

### Verifikasi Instalasi Plugin:
Jalankan `omp plugin list`. Anda akan melihat:
```text
npm Plugins:
● ompimpa@1.0.0
```

---

## Langkah 2: Inisialisasi Proyek Phoenix Target
Pindah ke direktori proyek Phoenix Anda dan jalankan inisialisasi:

```bash
cd /path/to/my_phoenix_app

# Jalankan inisialisasi tata kelola OMP-IMPA
ompimpa init
```

Perintah ini akan secara otomatis:
- Menghasilkan file konfigurasi `ompimpa.toml`.
- Menyiapkan direktori tata kelola internal `_ompimpa/` (`prd/`, `adr/`, `status/`, `solutions/`, `ideation/`).
- Menyiapkan kerangka dokumentasi resmi proyek di `docs/` (`tutorials/`, `how-to/`, `reference/`, `explanation/`).
- Menginjeksi file instruksi konteks `AGENTS.md` dan `CLAUDE.md`.
- Memasang Fast Git Pre-Commit Hook `.git/hooks/pre-commit` (sub-2-detik) untuk perlindungan 26 Hukum Besi.

---

## Langkah 3: Periksa Kesiapan Lingkungan (*Doctor*)
Jalankan diagnosa kesehatan proyek:

```bash
ompimpa doctor
```

Pastikan semua checklist konfigurasi, TTSR stream rules, plugin manifest, dan toolchain (`omp`, `mix`, `git`, `bun`, `rtk`) bertanda `[FOUND]` dan `[INSTALLED]`.

---

## Langkah 4: Jalankan Siklus Fitur Pertama Anda di Sesi OMP

Buka sesi interaktif OMP di proyek Anda:
```bash
omp
```

Di dalam prompt OMP, jalankan alur berurutan berikut:

### 1. Musyawarah Ideasi
```text
/ompimpa:ideate "Fitur transfer saldo instan antar-pengguna dengan PIN keamanan"
```
*Rohana Kudus dan Tan Malaka akan membedah ide, menggali persona, dan melarutkan kontradiksi teknis di `_ompimpa/ideation/`.*

### 2. Kunci Spesifikasi Master PRD
```text
/ompimpa:prd "Transfer Saldo Instan"
```
*H. Agus Salim akan menyusun Master PRD lengkap dengan Epics & Slices Spine di `_ompimpa/prd/`.*

### 3. Buat Tes Merah (Red-Phase ATDD)
```text
/ompimpa:atdd "Slice 1.1"
```
*Tuanku Imam Bonjol akan menganalisis acceptance criteria dan membuat tes ExUnit yang berstatus MERAH.*

### 4. Eksekusi Koding Otonom (Closed-Loop)
```text
/ompimpa:dev
```
*Spesialis backend menulis kode di isolated git worktree hingga tes merah berubah menjadi HIJAU, lalu otomatis menjalankan Micro/Macro-Review, triage, dan commit.*

### 5. Review & Verifikasi Kualitas
```text
/ompimpa:review
/ompimpa:verify
```
*Hj. Rasuna Said & Bagindo Azizchan mengaudit 26 Hukum Besi, keamanan, dan strict compiler.*

### 6. Dokumentasikan Panduan Diátaxis
```text
/ompimpa:doc user --epic 1
```
*Mohammad Yamin akan menghasilkan panduan resmi di folder `docs/`.*

Selamat! Anda telah menyelesaikan siklus rekayasa otonom pertama dengan OMP-IMPA sebagai OMP Plugin.
