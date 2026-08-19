# How-To: Menjalankan Ideasi Musyawarah dan Menyusun Master PRD

Panduan berorientasi tugas (*Task-Oriented*) ini menjelaskan cara membedah ide produk mentah, melarutkan trade-off arsitektur, dan menyusun Master PRD lengkap.

---

## 1. Memulai Musyawarah Ideasi (`/ompimpa:ideate`)

Ketik perintah berikut di sesi OMP Anda:
```bash
/ompimpa:ideate "Sistem otentikasi multi-tenant dengan biometric Passkey WebAuthn"
```

### Apa yang Terjadi di Balik Layar?
1. **Rohana Kudus (`ompimpa-ideate`)** memetakan empati pengguna (Says, Thinks, Does, Feels) dan merumuskan *How Might We (HMW)*.
2. **Tan Malaka (`ompimpa-triz`)** menganalisis kontradiksi teknis: *Bagaimana jika perangkat tidak mendukung WebAuthn? Bagaimana isolasi tenant saat login?*
3. **Marah Rusli (`ompimpa-ui`)** memberikan masukan tata letak modal dan transisi LiveView.

Hasil akhir musyawarah disimpan di `_ompimpa/ideation/IDEATION-[ID].md`.

---

## 2. Menyusun Master PRD (`/ompimpa:prd`)

Setelah ideasi selesai, ubah hasil ideasi menjadi dokumen spesifikasi resmi:

```bash
/ompimpa:prd "Otentikasi Multi-Tenant WebAuthn"
```

### Output yang Dihasilkan:
Dokumen Master PRD akan disimpan di `_ompimpa/prd/PRD-[ID]-[nama].md` dengan struktur:
- **Bab 1:** Ringkasan Eksekutif & Sasaran Bisnis.
- **Bab 2:** Persona & Peta Masalah.
- **Bab 3:** Batasan Ruang Lingkup (*In-Scope* vs *Non-Goals*).
- **Bab 4:** Kebutuhan Fungsional (FR) & Kebutuhan Non-Fungsional (NFR).
- **Bab 5:** Epics & Slices Spine dengan Kriteria Penerimaan Gherkin (`Given / When / Then`).
- **Bab 6:** Invariant Arsitektur & Keamanan.

---

## 3. Mencatat Keputusan Arsitektur (`/ompimpa:adr`)

Jika fitur ini membutuhkan pemilihan pustaka atau paradigma khusus (misal: *AshAuthentication vs Ueberauth*):

```bash
/ompimpa:adr "Pemilihan Stack Otentikasi WebAuthn Multi-Tenant"
```

H. Agus Salim akan menyusun naskah `_ompimpa/adr/ADR-[NUM]-[judul].md` berstandar MADR 3.0+ yang membandingkan alternatif dan mengunci invariant teknis.
