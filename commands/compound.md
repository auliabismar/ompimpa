---
description: Mencatat solusi teruji dari perbaikan bug atau keputusan arsitektur unik ke memori proyek
---

# Command: /ompimpa:compound

Menyimpan pembelajaran dan pola solusi dari insiden/bug yang berhasil dipecahkan agar menjadi pengetahuan institusional yang dapat diakses otomatis oleh agen di masa depan:

## Penggunaan
```bash
/ompimpa:compound [topik / ringkasan solusi]
```

## Alur Kerja
1. Mengekstrak akar penyebab masalah (*root cause*), pola perbaikan (*fix pattern*), dan invariant pencegahan regresi.
2. Menghasilkan berkas dokumentasi terstruktur di `_ompimpa/solutions/SOL-[ID]-[topik].md` lengkap dengan YAML frontmatter.
3. Mengindeks solusi agar otomatis terbaca oleh subagent `ompimpa-debug` saat melakukan investigasi masalah di masa depan.
