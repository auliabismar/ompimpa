# How-To: Menganalisis Blast-Radius Dependensi Modul (`/ompimpa:graphify`)

Panduan ini (*Task-Oriented*) menjelaskan cara memetakan dependensi modul Elixir, mendeteksi siklus melingkar (*circular dependencies*), dan menganalisis dampak perubahan (*blast-radius*) sebelum melakukan refactoring besar menggunakan `ompimpa graphify`.

---

## 1. Menghasilkan Graf Dependensi Proyek

Jalankan perintah graphify dari terminal shell OS atau prompt harness OMP:

```bash
# Dari terminal OS shell:
bin/ompimpa graphify

# Atau dari prompt OMP:
/ompimpa:graphify
```

### Mekanisme Ekstraksi Cepat (< 2 detik):
1. **Ekstraksi Primer**: Menggunakan `mix xref graph --format json --label compile-connected` dengan batas timeout 1.500 ms.
2. **Fallback LSP / Regex Scan**: Jika `mix xref` memerlukan waktu lebih dari 2 detik pada repositori besar (> 500 berkas), sistem secara mulus beralih ke analisis statis parsing `alias`, `use`, dan `import`.
3. **Penyimpanan Artefak**:
   - `_ompimpa/graph.json`: Berkas data terstruktur memuat simpul modul (*nodes*), relasi (*edges*), metrik keterkaitan, dan hasil pemeriksaan ketergantungan melingkar (*circular check*).
   - `_ompimpa/graph.html`: Visualisasi interaktif graf berbasis web yang dapat dibuka langsung di peramban.

---

## 2. Menghitung Blast-Radius Berkas Tertentu

Saat merencanakan refactoring pada modul core (misal skema database atau context accounts), Anda dapat mengukur berkas apa saja yang terdampak langsung maupun tidak langsung:

```bash
bin/ompimpa graphify --blast lib/my_app/accounts.ex
```

### Hasil Analisis Blast-Radius:
Sistem melakukan penelusuran balik (*Breadth-First Search / BFS reverse edges*) untuk mencatat seluruh modul yang bergantung pada berkas target:
```text
🔍 Menghitung Blast-Radius untuk: lib/my_app/accounts.ex
📊 Hasil Analisis:
  • Modul Terdampak Langsung:
    - lib/my_app_web/live/user_live/index.ex
    - lib/my_app_web/live/user_live/form_component.ex
  • Modul Terdampak Transisi:
    - lib/my_app_web/router.ex
  • Total Berkas Perlu Re-Testing: 3 berkas
```

---

## 3. Pemanfaatan dalam Siklus Kualitas OMP-IMPA

Data graf di `_ompimpa/graph.json` dimanfaatkan secara otomatis oleh:
* **Spesifikasi JIT (`/ompimpa:story`)**: Menyematkan daftar berkas *blast-radius* langsung ke dalam dokumen `_ompimpa/specs/SPEC-[ID].md`.
* **Panel Reviewer (`ompimpa-ecto` & `bmad_structural`)**: Memverifikasi batasan modularitas domain (aturan TEA-15) dan memastikan tidak ada dependensi melingkar (aturan TEA-16).
* **Master Inspect (`/ompimpa:inspect`)**: Menilai pilar *Batas (Boundary)* proyek pada skor scorecard 0–100.
