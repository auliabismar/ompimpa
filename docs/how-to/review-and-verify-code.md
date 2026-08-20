# How-To: Menjalankan Review Paralel dan Verifikasi Mutu Strict

Panduan ini menjelaskan cara melakukan audit menyeluruh terhadap 26 Hukum Besi, keamanan perimeter, mutu tes, dan kompilator sebelum kode di-merge ke branch utama.

---

## 1. Menjalankan Panel Review Paralel (`/ompimpa:review`)

Jalankan perintah review pada branch Anda:

```bash
/ompimpa:review
```

### 4 Jalur Pemeriksaan Paralel (Tier 1):
*(Catatan: Kesalahan sintaktis primitif seperti uang `:float` atau `String.to_atom` sudah otomatis dicegah di **Tier 0** oleh engine TTSR saat koding berlangsung).*

1. **Jalur Hukum Besi Semantik (`ompimpa-ironlaw` - Hj. Rasuna Said)**:
   Memindai seluruh diff git terhadap invariant arsitektur tingkat tinggi (otorisasi socket dinamis di setiap `handle_event/3`, supervisi proses di `application.ex`, idempotensi worker Oban, dan relasi multi-berkas).
2. **Jalur Keamanan (`ompimpa-security` - Bagindo Azizchan)**:
   Memindai celah keamanan mendalam (CSRF tokens, otorisasi IDOR, perlindungan sesi, dan audit Hex dependencies).
3. **Jalur Mutu Pengujian (`ompimpa-test` - Tuanku Imam Bonjol)**:
   Menilai suite tes dengan scorecard 0–100 (wajib $\ge 90$).
4. **Jalur Verifikasi Statis (`ompimpa-verify`)**:
   Menjalankan static analysis dan kompilasi.
### Hasil Output:
Jika lolos, laporan akan berstatus:
```text
🏆 [OMP-IMPA REVIEW: PASSED]
- Hukum Besi: 0 Pelanggaran
- Keamanan: 0 Kerentanan
- Scorecard Tes: 95/100
- Status: MERGEABLE
```

Jika ada pelanggaran, laporan berstatus **BLOCKED** disertai baris kode spesifik dan solusi perbaikannya.

---

## 2. Menjalankan Verifikasi Kompilator Strict (`/ompimpa:verify`)

Sebelum menyatakan pekerjaan selesai (Hukum Besi #26):

```bash
/ompimpa:verify
```

Perintah ini mengeksekusi secara berurutan:
1. `mix compile --warnings-as-errors`
2. `mix format --check-formatted`
3. `mix credo --strict`
4. `mix test`
