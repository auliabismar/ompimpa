# Tutorial: Memulai dengan OMP-IMPA dalam 15 Menit

Dokumen ini adalah panduan pembelajaran langkah demi langkah (*Tutorial*) untuk menginstal, menginisialisasi, dan menjalankan siklus rekayasa otonom pertama Anda menggunakan **OMP-IMPA** pada aplikasi Phoenix.

---

## Prasyarat
Sebelum memulai, pastikan sistem Anda memiliki:
1. **Oh My Pi (`omp`)**: Terpasang dan dapat dijalankan di terminal (`omp --version`).
2. **Bun**: Runtime JavaScript/TypeScript (`bun --version`).
3. **Elixir & Phoenix**: Proyek Phoenix yang aktif dengan `mix.exs`.

---

## Langkah 1: Tautkan Plugin ke OMP
Langkah pertama adalah mendaftarkan direktori plugin `ompimpa` ke engine OMP lokal Anda:

```bash
cd /home/aulia/ompimpa
bun run src/cli.ts link
```

**Verifikasi:**
Jalankan `omp plugin list`. Anda akan melihat:
```
npm Plugins:
● ompimpa@1.0.0
```

---

## Langkah 2: Inisialisasi Proyek Phoenix Target
Pindah ke direktori proyek Phoenix Anda (misalnya `mimar`) dan jalankan inisialisasi:

```bash
cd /path/to/my_phoenix_app
/home/aulia/ompimpa/bin/ompimpa init
```

Perintah ini akan secara otomatis:
- Menghasilkan file konfigurasi `ompimpa.toml`.
- Menginjeksi file instruksi konteks `AGENTS.md` dan `CLAUDE.md`.
- Memasang hook pre-commit `.git/hooks/pre-commit` untuk perlindungan 26 Hukum Besi.

---

## Langkah 3: Periksa Kesiapan Lingkungan (*Doctor*)
Jalankan diagnosa kesehatan proyek:

```bash
/home/aulia/ompimpa/bin/ompimpa doctor
```

Pastikan semua checklist konfigurasi dan toolchain (`mix`, `git`, `bun`, `rtk`) bertanda `[FOUND]` dan `[INSTALLED]`.

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
*Rohana Kudus dan Tan Malaka akan membedah ide, menggali persona, dan melarutkan kontradiksi teknis.*

### 2. Kunci Spesifikasi Master PRD
```text
/ompimpa:prd "Transfer Saldo Instan"
```
*H. Agus Salim akan menyusun Master PRD lengkap dengan Epics & Slices Spine di `docs/prd/`.*

### 3. Buat Tes Merah (Red-Phase ATDD)
```text
/ompimpa:atdd "Slice 1.1"
```
*Tuanku Imam Bonjol akan menganalisis acceptance criteria dan membuat tes ExUnit yang berstatus MERAH.*

### 4. Eksekusi Koding Otonom
```text
/ompimpa:dev
```
*Spesialis backend menulis kode di isolated git worktree hingga tes merah berubah menjadi HIJAU.*

### 5. Review & Verifikasi Kualitas
```text
/ompimpa:review
/ompimpa:verify
```
*Hj. Rasuna Said & Bagindo Azizchan mengaudit 26 Hukum Besi, keamanan, dan strict compiler.*

### 6. Dokumentasikan Panduan Diátaxis
```text
/ompimpa:doc user --story 1.1
```
*Mohammad Yamin akan menghasilkan User's Guide resmi di `docs/user/`.*

Selamat! Anda telah menyelesaikan siklus rekayasa otonom pertama dengan OMP-IMPA.
