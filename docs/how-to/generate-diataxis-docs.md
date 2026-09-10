# How-To: Menyusun Panduan Diátaxis untuk User, Admin, dan Developer

Panduan ini menjelaskan cara menggunakan subagent `ompimpa-doc` (Mohammad Yamin) untuk menghasilkan dokumentasi terstruktur berstandar 4 kuadran Diátaxis langsung dari PRD, Epic, Story, dan kode sumber riil.

---

## 1. Menghasilkan Panduan Pengguna (User's Guide)

Untuk membuat panduan alur kerja bagi pengguna akhir berdasarkan fitur di Epic atau Story tertentu:

```bash
/ompimpa:doc user --epic 8
# atau deterministik dari shell OS (tanpa argumen, output 4 kuadran):
bin/ompimpa doc
```

### Berkas yang Dihasilkan di `docs/` (`output_dir = "docs"`, `src/dokumentasi.ts:generateDocs`):
- **`docs/tutorials/01-getting-started.md`**: Langkah instal → init Greenfield/Brownfield → epic loop C-01..C-06.
- **`docs/how-to/how-to-use-liveview-streams.md`**: Contoh `stream/3` Hukum Besi #3 (>100 baris).
- **`docs/reference/configuration-toml.md`**: Spesifikasi `ompimpa.toml` + scoring v2 100/100.
- **`docs/explanation/tripartite-architecture.md`**: BMAD + phxagents + OMP Engine.

---

## 2. Menghasilkan Panduan Administrator (Admin's Guide)

Untuk membuat dokumentasi operasional dan tata kelola sistem:

```bash
/ompimpa:doc admin --story 1.2
```

### Berkas yang Dihasilkan tetap di `docs/` 4 kuadran (bukan `docs/admin/`):
- **`docs/how-to/`**: Prosedur tugas nyata hasil generate deterministik.
- **`docs/reference/`**: Spesifikasi teknis (`configuration-toml.md`, `26-iron-laws.md`).

---

## 3. Menghasilkan Panduan Pengembang (Developer's Guide)

Untuk mendokumentasikan modul teknis, arsitektur, dan referensi API:

```bash
/ompimpa:doc dev --module Accounts
```

### Berkas yang Dihasilkan tetap di `docs/` 4 kuadran (bukan `docs/dev/`):
- **`docs/reference/`**: Spesifikasi skema Ecto/Ash Resources, Actions, parameter event LiveView.
- **`docs/explanation/`**: Alasan arsitektur, trade-off ADR, dan 26 Hukum Besi yang relevan.
