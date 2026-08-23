# How-To: Menjalankan Deliberasi Sidang Balairung (`/ompimpa:balairung`)

Panduan berorientasi tugas (*Task-Oriented*) ini menjelaskan cara membuka sidang musyawarah multi-persona **Balairung Sari** untuk mengambil keputusan arsitektur strategis, menyelesaikan dilema produk, dan melarutkan trade-off teknis menggunakan protokol 3-ronde.

---

## 1. Memulai Sidang Balairung

### Skenario A: Mode Default (Auto-Pick Anggota Berdasarkan Topik)
Ketik topik keputusan yang ingin dibahas:

```bash
/ompimpa:balairung "Apakah kita perlu migrasi dari Vanilla Ecto ke Ash Framework untuk fitur multi-tenant?"
```

*Sistem otomatis memilih persona yang paling relevan (misal: Syekh Ahmad Khatib, Bung Hatta, Tan Malaka, dan Bagindo Azizchan).*

---

### Skenario B: Mode Full Council (Seluruh Anggota Dewan)
Untuk keputusan fundamental berskala besar yang menentukan arah arsitektur seluruh sistem:

```bash
/ompimpa:balairung --full "Penyimpanan transaksi finansial: Event Sourcing vs CRUD Relasional ACID"
```

---

### Skenario C: Mode Triad Tematik (3 Persona Khusus)
Untuk musyawarah terarah pada ranah spesifik:

```bash
# Triad Arsitektur (Tan Malaka + Bung Hatta/Ahmad Khatib + Sutan Sjahrir)
/ompimpa:balairung --triad arsitektur "Pilih Redis PubSub atau Phoenix.PubSub native BEAM?"

# Triad Risiko & Keamanan (Hj. Rasuna Said + Bagindo Azizchan + Tuanku Imam Bonjol)
/ompimpa:balairung --triad risiko "Rilis fitur pembayaran instan tanpa verifikasi KYC penuh"

# Triad Produk & UX (Rohana Kudus + H. Agus Salim + Marah Rusli)
/ompimpa:balairung --triad produk "Rilis MVP tanpa fitur ekspor laporan ke PDF"
```

---

## 2. Apa yang Terjadi Selama 3 Ronde?

Protokol Balairung menjamin kedalaman analisis dan mencegah persetujuan semu (*anti-sycophancy*):

1. **Ronde 1: Pandangan Independen (Blind Opening)**:
   Setiap persona menulis analisis mandiri tanpa saling melihat. Setiap argumen diberi label kepastian bukti: `[FACT]`, `[INFERENCE]`, `[ASSUMPTION]`, dan `[UNKNOWN]`.
2. **Ronde 2: Debat Silang & Dialektika (Cross-Examination)**:
   Seluruh analisis dibuka ke forum. Persona saling menantang asumsi, mengekspos blind spot, dan menguji skenario kegagalan ekstrem (*worst-case scenario*).
3. **Ronde 3: Sintesis Mufakat & Keputusan (The Verdict)**:
   Merumuskan rekomendasi mufakat, mencatat *Dissenting Opinions* (suara minoritas yang tidak setuju), menetapkan *Kill Criteria*, dan menentukan langkah konkret berikutnya.

---

## 3. Struktur Berkas Risalah Balairung

Hasil sidang disimpan secara permanen di:
📁 **`_ompimpa/balairung/BALAIRUNG-[YYYYMMDD-HHMM]-[slug].md`**

Berkas ini memuat:
- **Ringkasan Topik & Batasan Masalah**.
- **Log Ronde 1 (Blind Analysis)** dari setiap persona yang hadir.
- **Log Ronde 2 (Debat Silang & Dialektika)**.
- **Verdict Akhir**:
  - Rekomendasi Mufakat.
  - Suara Berbeda (*Dissenting Opinions*).
  - Batas Pembatalan Keputusan (*Kill Criteria*).
  - Rekomendasi Tindak Lanjut (misal: menyusun `/ompimpa:adr` atau `/ompimpa:prd`).

---

## 4. Memanfaatkan Hasil Balairung di Workflow Lain

Berkas risalah Balairung adalah **dokumen rujukan bebas (*Independent Reference Artifact*)**:
* Saat menyusun PRD: `/ompimpa:prd "Sistem Multi-Tenant"` dapat merujuk ke risalah Balairung terkait.
* Saat menyusun ADR: `/ompimpa:adr "Keputusan Ash vs Ecto"` dapat langsung mengutip argumen dan *kill criteria* dari Balairung.
* Saat koding di `/ompimpa:dev`: Spesialis backend mematuhi invariant yang telah dimufakatkan di Balairung.
