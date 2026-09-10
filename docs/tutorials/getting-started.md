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

Perintah ini secara otomatis mendeteksi tipe repositori target (**Setup Wizard C-04**):
- **Greenfield (`scope=full`)**: Jika `mix.exs` tidak ada atau direktori `lib/` kosong, sistem men-scaffold penuh konfigurasi `ompimpa.toml`, struktur `docs/`, `AGENTS.md`, `CLAUDE.md`, `_ompimpa/stories.yaml`, dan fast pre-commit hook.
- **Brownfield (`scope=delta`)**: Jika `mix.exs` ada dan `lib/` sudah berisi kode, sistem melakukan sinkronisasi delta aman tanpa menimpa kode yang ada, mendeteksi penggunaan Ash Framework dan Oban, serta menginjeksi tata kelola OMP-IMPA secara non-destruktif.

Artefak yang disiapkan:
- File konfigurasi proyek `ompimpa.toml`.
- Direktori tata kelola internal `_ompimpa/` (`stories.yaml`, `criteria_registry_35.json`, `specs/`, `review/`, `prd/`, `adr/`, `status/`, `solutions/`, `ideation/`).
- Direktori dokumentasi Diátaxis resmi proyek di `docs/` (`tutorials/`, `how-to/`, `reference/`, `explanation/`).
- Hook Git Fast Pre-Commit (`.git/hooks/pre-commit`) sub-2-detik untuk menjaga integritas 26 Hukum Besi.

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

Di dalam prompt OMP, jalankan alur 2 sesi bersih berikut:

#### **Sesi 1: Discovery & Desain Produk (Chat / Diskusi)**
1. **Musyawarah Ideasi**:
   ```text
   /ompimpa:ideate "Fitur transfer saldo instan antar-pengguna dengan PIN keamanan"
   ```
   *Rohana Kudus dan Tan Malaka akan membedah ide, menggali persona, dan melarutkan kontradiksi teknis di `_ompimpa/ideation/`.*

2. **Kunci Spesifikasi Master PRD**:
   ```text
   /ompimpa:prd "Transfer Saldo Instan"
   ```
   *H. Agus Salim akan menyusun Master PRD lengkap dengan Epics & Slices Spine di `_ompimpa/prd/`.*

3. **Desain Komponen UI & Layout** (jika ada tampilan):
   ```text
   /ompimpa:ui "Form Transfer Saldo"
   ```
   *(Tutup sesi chat OMP untuk menghemat jendela konteks / token).*

---

#### **Sesi 2: Engineering & Eksekusi Otonom (Fresh Session)**
Buka sesi OMP baru (`omp`), lalu langsung jalankan:

4. **Eksekusi Dev Otonom Terpadu (Closed-Loop)**:
   ```text
   /ompimpa:dev --auto
   ```
   *Alur ini otomatis melakukan:*
   - **JIT Micro-Spec & ATDD Red-Phase**: Tuanku Imam Bonjol membuat spesifikasi mikro di `_ompimpa/specs/` dan tes penerimaan ExUnit merah dengan pemetaan 100% Gherkin (TEA-01 Traceability).
   - **Koding Hijau**: Spesialis backend menulis kode di isolated git worktree hingga tes merah berubah menjadi HIJAU.
   - **10-Isolated Review & Triage**: Panel 10 subagent (4 BMAD + 6 Tech) mengaudit kode, mendeduplikasi temuan dengan hash `file:line:ruleId`, dan memastikan kelulusan 100/100 PASS sebelum commit semantik.

   > 💡 **Opsi Outer Loop Terminal OS**: Anda juga dapat menjalankan seluruh epic langsung dari shell OS tanpa risiko token burnout:
   > ```bash
   > bin/ompimpa dev --epic EPIC-A --auto
   > ```

### 5. Review, Verifikasi, & Diagnostik Proyek
```text
/ompimpa:review
/ompimpa:verify
/ompimpa:inspect
```
*Panel 10 reviewer mengaudit kepatuhan kode, compiler strict memverifikasi kelulusan build, dan Master Inspect mengevaluasi 4 pilar arsitektur.*
### 6. Dokumentasikan Panduan Diátaxis
```text
/ompimpa:doc
```
*Mohammad Yamin + generator deterministik `src/dokumentasi.ts:generateDocs` menghasilkan 4 kuadran di `docs/` (`tutorials/`, `how-to/`, `reference/`, `explanation`). Dari shell OS: `bin/ompimpa doc` (tanpa argumen).*

Selamat! Anda telah menyelesaikan siklus rekayasa otonom pertama dengan OMP-IMPA sebagai OMP Plugin.
