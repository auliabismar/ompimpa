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
