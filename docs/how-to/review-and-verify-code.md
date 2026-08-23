# How-To: Menjalankan Review Paralel dan Verifikasi Mutu Strict

Panduan ini menjelaskan cara melakukan audit menyeluruh terhadap 26 Hukum Besi, keamanan perimeter, mutu tes, dan kompilator sebelum kode di-merge ke branch utama.

---

## 1. Menjalankan Panel Review Paralel (`/ompimpa:review`)

Jalankan perintah review pada branch Anda:

```bash
/ompimpa:review
```

### 6 Jalur Pemeriksaan Paralel (Multi-Subagent Panel):
*(Catatan: Kesalahan sintaktis primitif seperti uang `:float` atau `String.to_atom` sudah otomatis dicegah di **Tier 0** oleh engine TTSR saat koding berlangsung).*

1. **Jalur Hukum Besi Semantik (`ompimpa-ironlaw` - Hj. Rasuna Said)**:
   Memindai seluruh diff git terhadap invariant arsitektur tingkat tinggi (otorisasi socket dinamis di setiap `handle_event/3`, supervisi proses di `application.ex`, dan relasi multi-berkas).
2. **Jalur Keamanan Perimeter (`ompimpa-security` - Bagindo Azizchan)**:
   Memindai celah keamanan mendalam (CSRF tokens, otorisasi IDOR, perlindungan sesi, dan audit Hex dependencies).
3. **Jalur Mutu Pengujian (`ompimpa-test` - Tuanku Imam Bonjol)**:
   Menilai suite tes dengan scorecard 0–100 (wajib $\ge 90$) dan isolasi sandbox.
4. **Jalur Verifikasi Statis (`ompimpa-verify`)**:
   Menjalankan kompilasi strict (`mix compile --warnings-as-errors`) dan format check.
5. **Jalur Database & Query (`ompimpa-ecto` / `ash`)**:
   Memindai potensi anti-pattern N+1 queries, pinning operator `^` pada query Ecto, dan fail-closed Ash authorization policies.
6. **Jalur LiveView & Background Jobs (`ompimpa-liveview` / `oban`)**:
   Memeriksa memory hygiene socket assigns, Stream container pada dataset > 100 baris, dan idempotensi worker Oban.
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

## 2. Menjalankan Verifikasi Menyeluruh (`/ompimpa:verify`)

Sebelum menyatakan pekerjaan selesai atau membuka Pull Request (Hukum Besi #26):

```bash
/ompimpa:verify
```

### Perbedaan Fast Pre-Commit vs Full Verify:
* **Fast Pre-Commit Gate (di `.git/hooks/pre-commit`)**: Berjalan cepat dalam < 2 detik pada setiap `git commit` (hanya menjalankan scan diff staged, `mix compile --warnings-as-errors`, dan `mix format --check-formatted`).
* **Full Verification (`/ompimpa:verify` / `mix impa.verify`)**: Mengeksekusi verifikasi mendalam secara menyeluruh:
  1. `mix compile --warnings-as-errors`
  2. `mix format --check-formatted`
  3. `mix credo --strict` (jika terpasang)
  4. `mix sobelow --config --exit` (jika terpasang)
  5. `mix test` (menjalankan seluruh rangkaian tes proyek)
