# Penjelasan: Struktur Berkas, Penempatan Plugin, & Pelacakan Git

Dokumen penjelasan (*Understanding-Oriented*) ini menjawab secara tuntas:
1. **Di mana berkas-berkas mesin `ompimpa` berada setelah deployment/instalasi?**
2. **Bagaimana pemisahan antara artefak internal tata kelola (`_ompimpa/`) dan dokumentasi resmi Diátaxis proyek (`docs/`)?**
3. **Apakah berkas-berkas tersebut dimasukkan ke dalam Git?**

---

## 1. Pemisahan Dua Lapisan: Plugin Engine vs Project Governance

Di OMP-IMPA, berkas dipisahkan secara tegas antara **Mesin Plugin Global** dan **Tata Kelola Proyek Lokal**:

```
                       ┌─────────────────────────────────────────────────────────────┐
                       │ 1. MESIN PLUGIN OMP-IMPA (Tersimpan di Luar Repo Target)    │
                       │    Lokasi: `/path/to/ompimpa` atau `~/.omp/plugins/`        │
                       └─────────────────────────────────────────────────────────────┘
                                                      │
                       • Berisi: `agents/`, `commands/`, `skills/`, `rules/`, `bin/`
                       • Didaftarkan sekali ke OMP via `omp plugin link /path/to/ompimpa`
                       • DIBAGI BERSAMA ke seluruh proyek Phoenix di mesin Anda.
                       • TIDAK PERLU disalin ke dalam repo proyek target.
                                                      │
                                                      │ Diinjeksi saat `ompimpa init`
                                                      ▼
                       ┌─────────────────────────────────────────────────────────────┐
                       │ 2. BERKAS TATA KELOLA PROYEK (Di Dalam Repo Target Phoenix) │
                       └─────────────────────────────────────────────────────────────┘
```

---

## 2. Struktur Berkas di Dalam Proyek Target & Pemisahan `_ompimpa/` vs `docs/`

Saat Anda menjalankan `ompimpa init` di proyek Phoenix target, sistem memisahkan dengan tegas antara **Artefak Tata Kelola Internal Mesin (`_ompimpa/`)** dan **Dokumentasi Resmi Proyek (`docs/`)**:

```
target_phoenix_project/
├── ompimpa.toml                       # [TRACKED IN GIT] Konfigurasi tata kelola & model
├── AGENTS.md                          # [TRACKED IN GIT] Konteks instruksi subagent
├── CLAUDE.md                          # [TRACKED IN GIT] Aturan ringkas proxy RTK
├── .git/hooks/pre-commit              # [LOCAL ONLY] Hook pencegah pelanggaran Hukum Besi
│
├── _ompimpa/                          # [TRACKED IN GIT - ARTEFAK INTERNAL TATA KELOLA AI]
│   ├── status/
│   │   └── feature-status.yaml        # [GIT] State roadmap mesin & status tiap slice
│   ├── prd/
│   │   └── PRD-[ID]-[nama].md         # [GIT] Dokumen Master PRD & Epics Spine
│   ├── adr/
│   │   └── ADR-[NUM]-[judul].md       # [GIT] Keputusan arsitektur berstandar MADR
│   ├── ideation/
│   │   └── IDEATION-[ID].md           # [GIT] Ringkasan musyawarah & analisis TRIZ
│   └── solutions/
│       └── SOL-[ID]-[slug].md         # [GIT] Memori institusional perbaikan bug teruji
│
└── docs/                              # [TRACKED IN GIT - DOKUMENTASI DIÁTAXIS RESMI PROYEK]
    ├── tutorials/                     # [GIT] Panduan belajar langkah demi langkah pengguna baru
    ├── how-to/                        # [GIT] Panduan menyelesaikan tugas spesifik aplikasi
    ├── reference/                     # [GIT] Referensi teknis API, skema, dan konfigurasi
    └── explanation/                   # [GIT] Penjelasan arsitektur dan nalar desain sistem
```

---

## 3. Mengapa Keduanya Wajib Masuk ke Git?

1. **`_ompimpa/` Masuk ke Git**:
   - Menjadi **Jangkar Kebenaran Persisten (*State Anchor*)**.
   - Ketika developer lain atau agen AI di sesi baru/komputer lain melakukan `git pull`, seluruh riwayat PRD, keputusan ADR, memori solusi bug, dan status roadmap tersedia secara utuh.
   - Sesi `/ompimpa:dev` dapat dilanjutkan kapan saja tanpa ada konteks yang hilang.
2. **`docs/` Masuk ke Git**:
   - Menjadi **Dokumentasi Hidup Proyek (*Living Documentation*)** yang bersih dari berkas internal mesin AI.
   - Siap dipublikasikan menjadi portal dokumentasi pengguna/developer (misal via ExDoc, MkDocs, Docusaurus, atau Astro).
