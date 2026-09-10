---
name: diataxis-documentation
description: Menyusun dokumentasi terstruktur berdasarkan standar 4 kuadran Diátaxis (Tutorials, How-To Guides, Reference, Explanation) untuk User, Admin, dan Developer.
---

# Skill: Diátaxis Documentation Framework

## Matriks 4-Kuadran Diátaxis

```
                            PRACTICAL (Aksi Nyata)       THEORETICAL (Nalar & Konsep)
                           ┌────────────────────────────┬─────────────────────────────────┐
       LEARNING-ORIENTED   │ 1. TUTORIALS               │ 4. EXPLANATION                  │
      (Tahap Pembelajaran) │    - Orientasi belajar     │    - Orientasi pemahaman konsep │
                           │    - Langkah berurutan     │    - Latar belakang & arsitektur│
                           ├────────────────────────────┼─────────────────────────────────┤
          TASK-ORIENTED    │ 2. HOW-TO GUIDES           │ 3. REFERENCE                    │
     (Penyelesaian Masalah)│    - Orientasi tugas nyata │    - Orientasi informasi teknis │
                           │    - Solusi masalah konkrit│    - Spesifikasi, API, Schema   │
                           └────────────────────────────┴─────────────────────────────────┘
```

## Aturan Utama Penulisan
1. **Dilarang Mencampuradukkan Kuadran**:
   - Jangan menyisipkan teori arsitektur panjang di dalam How-To Guide.
   - Jangan menulis langkah tutorial di dalam halaman Reference.
2. **Keterikatan dengan Kode Aktual**:
   - Semua contoh kode dan nama variabel wajib 100% valid dan sinkron dengan implementasi proyek.
3. **Pengelompokan Direktori**:
   - Panduan Pengguna: `docs/user/`
   - Panduan Administrator: `docs/admin/`
   - Panduan Pengembang: `docs/dev/`

## C-05 Generator Deterministik (Port dokumentasi_generator.py 77KB)

Generator deterministik \`src/dokumentasi.ts:generateDocs()\` membangun 4 kuadran tanpa placeholder:

- **Input:** \`_ompimpa/stories.yaml\` (15 stories DAG), \`_ompimpa/adr/*.md\`, \`_ompimpa/graph.json\` (blast-radius).
- **Output:**
  - \`docs/tutorials/01-getting-started.md\` — langkah instal → init Greenfield/Brownfield → epic loop C-01..C-06, auto-sync stories count.
  - \`docs/how-to/how-to-use-liveview-streams.md\` — Hukum Besi #3 streams >100 baris, contoh \`stream/3\` boring.
  - \`docs/reference/configuration-toml.md\` — tiered T1/T2/T3, scoring v2 100/100.
  - \`docs/explanation/tripartite-architecture.md\` — BMAD + phxagents + OMP Engine.
- **Deterministik:** Tiap run \`ompimpa doc\` hasil byte-identik (kecuali timestamp), 0 \`TODO\`/`placeholder`/`lorem`, valid Diátaxis via \`validateDiataxisStructure()\`.
- **Perintah:** \`ompimpa doc\` → \`generateDocs()\` → tulis 4 kuadran, cek placeholder, hitung quadrants.
- **AC-C05-1:** \`stories.yaml\` 15 story → \`docs/\` 4 kuadran ter-generate, 0 placeholder, \`valid=true\`.
