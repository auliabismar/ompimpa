---
description: Menghasilkan spesifikasi mikro just-in-time (_ompimpa/specs/SPEC-[ID].md) sebelum ATDD bersama H. Agus Salim (ompimpa-prd)
---

# Command: /ompimpa:story

> 📌 **Keputusan arsitektur: TIDAK ADA format story file kedua.** Berkas `_ompimpa/specs/SPEC-[STORY_ID].md` yang diterbitkan perintah ini ADALAH story file ala BMAD (setara spec-template upstream: frontmatter status lifecycle, `<frozen-after-approval>` Intent, Open Questions gate, Code Map, Tasks & Acceptance per-berkas, Implementation Notes, Spec Change Log, Review Triage Log, Verification). PRD hanya memuat Gherkin + FR; seluruh kontrak eksekusi tinggal di SPEC.

Jalankan subagent `ompimpa-prd` (H. Agus Salim) untuk merumuskan berkas spesifikasi mikro *just-in-time* (`_ompimpa/specs/SPEC-[STORY_ID].md`) sesaat sebelum fase Red-Phase ATDD (`/atdd`) dan implementasi koding (`/code`).
---

## Profil Persona: H. Agus Salim (`ompimpa-prd`)

Terinspirasi dari ketajaman diplomasi, kecerdasan nalar, dan ketertiban bahasa **H. Agus Salim** (*The Grand Old Man*), perintah ini merumuskan kontrak rekayasa perangkat lunak secara elegan, tanpa ambiguitas, dan langsung dapat dieksekusi oleh mesin pengujian otomatis:
- **Ketertiban Kontrak:** Setiap kriteria penerimaan diubah menjadi skenario Gherkin siap uji (`Given / When / Then`).
- **Presisi Tanda Tangan:** Menentukan tanda tangan fungsi, arity, dan typespecs secara eksak sebelum sebaris kode ditulis.
- **Kesadaran Perimeter:** Menghitung dampak perubahan (*blast-radius*) secara *lazy* menggunakan `mix xref callers` jika menyentuh modul konteks inti (*core context*).

---

## Penggunaan

### Di Dalam Sesi OMP Harness
```bash
/ompimpa:story <STORY_ID>           # Contoh: /ompimpa:story D-01
/story <STORY_ID>                   # Alias singkat
```

### Di Terminal OS Shell (Outer CLI)
```bash
ompimpa story <STORY_ID>            # Menghasilkan berkas _ompimpa/specs/SPEC-[ID].md
ompimpa story <STORY_ID> --dry-run  # Pratinjau dokumen spesifikasi tanpa menulis ke disk
ompimpa story <STORY_ID> --force    # Tulis ulang spesifikasi meskipun berkas sudah ada
```

---

## Alur Kerja Terpadu (Workflow)

```
[1. BACA STORIES.YAML]  ──► Memvalidasi <STORY_ID> di `_ompimpa/stories.yaml`, periksa ketergantungan DAG (`depends_on`).
                                  │
[2. AMBIL KONTEKS MAKRO]──► Membaca PRD makro (`_ompimpa/prd/`) dan MADR (`_ompimpa/adr/`) sesuai Epic.
                                  │
[3. LAZY BLAST-RADIUS]  ──► Jika `target_files` menyentuh core context (`lib/core/`, schema, auth):
                            panggil `mix xref callers <file>` atau baca `_ompimpa/graph.json`.
                                  │
[4. SINTESIS KONTRAK]   ──► Rumuskan:
                            • Skenario Gherkin presisi per fungsi (`Given / When / Then`) berlabel `@tea-01`.
                            • Tanda tangan fungsi (*exact function signatures, typespecs, & arity*).
                            • Skema data / migrasi Ecto atau Ash resource (Hukum Besi #1: Dilarang :float).
                            • Pemisahan berkas target implementasi dan berkas uji ATDD.
                                  │
[5. TERBITKAN SPEC-*.md]──► Tulis berkas deterministik ke `_ompimpa/specs/SPEC-[STORY_ID].md`.
                                  │
[6. HAND-OFF KE /atdd]  ──► Teruskan ke Tuanku Imam Bonjol (`/atdd <STORY_ID>`) untuk membuat tes merah failing.
```

---

## Format Standar Berkas `_ompimpa/specs/SPEC-[STORY_ID].md`

Setiap berkas spesifikasi JIT yang diterbitkan wajib memuat 7 bagian utama:

1. **Header & Metadata Tata Kelola:**
   - Status, Epic ID, Story ID, Prioritas, TEA Tier, Estimasi, Scoring Impact.
   - Penulis (`ompimpa-prd` / H. Agus Salim) dan tanggal terbit.
   - Tautan langsung ke berkas PRD makro dan ADR terkait.
2. **Ringkasan Cerita & Ketergantungan DAG:**
   - Deskripsi lengkap kebutuhan fitur.
   - Status dependensi DAG (`depends_on`).
3. **Skenario Gherkin Presisi (ATDD Ready — TEA-01):**
   - Format `Feature:` dan `Scenario:` lengkap dengan tag `@ac-[id]` dan `@tea-01`.
   - Klausul `Given / When / Then` yang presisi dan bebas ambiguitas.
4. **Tanda Tangan Fungsi & Kontrak Antarmuka (*Function Signatures & Typespecs*):**
   - Tanda tangan fungsi pasti dengan typespecs Elixir (`@spec func(args) :: return`) atau TypeScript.
   - Arity modul dinyatakan eksplisit (misal: `generateStorySpec/2`, `execute/2`).
5. **Skema Data & Konfigurasi Ecto / Ash Resource:**
   - Struktur entitas, kolom, tipe data, dan konstrain.
   - Penegakan Hukum Besi #1: Dilarang tipe `:float` untuk uang (wajib `:decimal`).
   - Penegakan kebijakan otorisasi *fail-closed* (*default deny*) untuk Ash resource.
6. **Analisis Dampak & Blast-Radius (*Lazy mix xref*):**
   - Status sentuhan core context.
   - Metode pemindaian (`mix_xref`, `graph_json`, atau `leaf_isolated`).
   - Daftar modul pemanggil terdampak (*callers*).
7. **Daftar Berkas Target & Berkas Uji:**
   - Berkas implementasi produksi (*Production targets*).
   - Berkas tes penerimaan (*Red-Phase ATDD targets*).
8. **Batas Penghentian & Gerbang Kualitas (*Kill Criteria & Quality Gates*):**
   - Kriteria pembatalan (*Kill criteria*).
   - Kepatuhan TEA-01 (100% AC terikat asersi tes, 0 flaky sleep, 0 asersi formalitas).
   - Target kelulusan mutlak 100/100 PASS pada evaluasi `/triage`.

---

## Integrasi dengan Rantai Perintah Rekayasa (Outer Loop Pipeline)

Sesuai ketetapan **ADR-002**, perintah `/ompimpa:story` adalah pintu gerbang pertama dari 5 fase rekayasa modular:
1. **`/ompimpa:story <ID>`** ➔ Menyiapkan kontrak mikro JIT `SPEC-[ID].md`.
2. **`/atdd <ID>`** ➔ Mengonversi skenario Gherkin menjadi tes merah ExUnit failing.
3. **`/code <ID>`** ➔ Menulis kode produksi hingga seluruh tes hijau.
4. **`/review <ID>`** ➔ Dispatch paralel 10 subagent isolated review (4 BMAD + 6 Tech).
5. **`/triage <ID>`** ➔ Deduplikasi hash dan vonis scorecard 100/100.
