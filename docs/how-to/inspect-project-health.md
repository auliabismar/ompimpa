# How-To: Menjalankan Master Diagnostik 4-Pilar Proyek (`/ompimpa:inspect`)

Panduan ini (*Task-Oriented*) menjelaskan cara mengeksekusi pemindaian kesehatan arsitektur menyeluruh di luar siklus koding (*out-of-band*) menggunakan `/ompimpa:inspect` atau CLI `bin/ompimpa inspect`, membaca scorecard 4-pilar, dan mengelola penerbitan otomatis backlog hutang teknis ke `EPIC-DEBT`.

---

## 1. Menjalankan Master Diagnostic

Jalankan pemindaian penuh dari terminal harness OMP atau terminal OS shell:

```bash
# Dari prompt OMP:
/ompimpa:inspect

# Atau dari shell OS:
bin/ompimpa inspect
```

### Opsi & Filter Pemindaian:
* **`--dry-run`**: Melakukan pemindaian lengkap dan menampilkan scorecard di layar tanpa mengubah berkas `stories.yaml` atau `deferred.md`.
* **`--boundaries`**: Memfokuskan evaluasi pada pilar batas modularitas arsitektur.
* **`--perf`**: Memfokuskan evaluasi pada pilar performa, latensi NFR, dan anti-pattern query.
* **`--security`**: Memfokuskan evaluasi pada pilar keamanan perimeter, 26 Hukum Besi, dan dependensi Hex.
* **`--docs`**: Memfokuskan evaluasi pada kelengkapan 4 kuadran Diátaxis tanpa stub semu.

Contoh eksekusi terfokus:
```bash
bin/ompimpa inspect --perf --dry-run
```

---

## 2. Membaca Scorecard 4-Pilar

Hasil diagnosa dievaluasi pada skala 0–100 untuk masing-masing 4 pilar arsitektur:

```text
📊 Scorecard Master Diagnostic 4 Pilar:
  • Batas (Boundary & Modular): 100/100
  • Performa (Latency & NFR):   100/100
  • Keamanan (Security & Laws):  100/100
  • Docs (Diátaxis 4 Kuadran):  100/100
  • Overall Score:              100/100
📄 Report: _ompimpa/inspeksi/report.md
```

### Rincian Evaluasi Tiap Pilar:
1. **Pilar Batas (Boundary & Modular)**:
   - Memindai kebocoran batas domain antar-konteks via `mix xref`.
   - Menghitung coupling/cohesion dan mendeteksi dependensi melingkar (*circular dependencies*).
2. **Pilar Performa (Latency & NFR)**:
   - Memindai query tidak terbatas di mount LiveView (Hukum Besi #2).
   - Memeriksa penggunaan Streams pada daftar > 100 baris (Hukum Besi #3).
   - Menilai kepatuhan target latensi p95 (`target_p95_latency_ms = 50`).
3. **Pilar Keamanan & 26 Hukum Besi**:
   - Memindai penggunaan uang float (Hukum Besi #1), `String.to_atom` (Hukum Besi #17), dan SQL raw interpolation (Hukum Besi #4).
   - Audit keamanan perimeter Phoenix dan advisori Hex.
4. **Pilar Dokumentasi (Diátaxis 4 Kuadran)**:
   - Memeriksa eksistensi berkas di folder `tutorials/`, `how-to/`, `reference/`, dan `explanation/`.
   - Memastikan tidak ada token penampung sementara (`TBD`, `catatan semu`, `lorem ipsum`).

---

## 3. Laporan Rinci & Auto-Triage ke `EPIC-DEBT`

Setelah pemindaian selesai:
1. **Laporan Audit Fisik**: Naskah lengkap hasil temuan ditulis ke `_ompimpa/inspeksi/report.md`.
2. **Auto-Triage ke `EPIC-DEBT` (Story E-03)**:
   - Jika ditemukan pelanggaran berkategori **P0 (Blocker)** atau **P1 (Warning)**, sistem secara otomatis:
     - Menerbitkan story baru di bawah `epic: EPIC-DEBT` di dalam berkas `_ompimpa/stories.yaml`.
     - Menyusun Kriteria Penerimaan Gherkin untuk perbaikan isu tersebut.
     - Menyematkan story hutang teknis ke dalam Directed Acyclic Graph (DAG) agar dapat dieksekusi secara sistematis via `bin/ompimpa dev --epic EPIC-DEBT`.
3. **Catatan Rekomendasi P2**:
   - Temuan berkategori P2 (Suggestion) dicatat rapi ke dalam `_ompimpa/deferred.md` untuk perbaikan inkremental di masa mendatang.
