# How-To: Menjalankan Deliberasi Sidang Balairung (`/ompimpa:balairung`)

Panduan berorientasi tugas (*Task-Oriented*) ini menjelaskan cara membuka sidang musyawarah multi-persona **Balairung Sari** untuk mengambil keputusan arsitektur strategis, menyelesaikan dilema produk, dan melarutkan trade-off teknis menggunakan protokol 3-ronde.

---

## 1. Memulai Sidang Balairung

### Skenario A: Mode Default (Auto-Pick Anggota Berdasarkan Topik)
Ketik topik keputusan yang ingin dibahas:

```bash
/ompimpa:balairung "Apakah kita perlu migrasi dari Vanilla Ecto ke Ash Framework untuk fitur multi-tenant?"
```

*Sistem otomatis memilih persona yang paling relevan (misal: Mr. Assaat, Bung Hatta, Tan Malaka, dan Bagindo Azizchan).*

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
# Triad Arsitektur (Tan Malaka + Bung Hatta/Mr. Assaat + Sutan Sjahrir)
/ompimpa:balairung --triad arsitektur "Pilih Redis PubSub atau Phoenix.PubSub native BEAM?"

# Triad Risiko & Keamanan (Hj. Rasuna Said + Bagindo Azizchan + Tuanku Imam Bonjol)
/ompimpa:balairung --triad risiko "Rilis fitur pembayaran instan tanpa verifikasi KYC penuh"

# Triad Produk & UX (Rohana Kudus + H. Agus Salim + Marah Rusli)
/ompimpa:balairung --triad produk "Rilis MVP tanpa fitur ekspor laporan ke PDF"
```

---

## 2. Alur Sidang: Dari Musyawarah Interaktif hingga Ketuk Palu

Sidang Balairung Sari mengadopsi mekanisme **Party Mode Multi-Turn**. Anda memegang kendali penuh sebagai **Ketua Sidang / Pimpinan Majelis**:

### Tahap 1: Pembukaan & Posisi Awal (Open Floor)
* Setelah Anda menjalankan `/ompimpa:balairung`, masing-masing tokoh memaparkan posisi awal secara ringkas.
* Setiap argumen diberi label kepastian bukti: `[FACT]`, `[INFERENCE]`, `[ASSUMPTION]`, dan `[UNKNOWN]`.
* Koordinator Balairung menyimpulkan titik gesekan utama dan **menyerahkan giliran (*Yield Turn*)** kepada Anda untuk memulai pembahasan.

### Tahap 2: Diskusi & Debat Silang Terbuka (Active Deliberation)
* Anda berdiskusi langsung dengan dewan di dalam layar chat:
  * **Menantang asumsi**: *"Asumsi Bung Hatta tentang load database tidak relevan karena kita memakai caching."*
  * **Meminta elaborasi persona**: *"@tan-malaka bagaimana jika kita terapkan prinsip pemisahan waktu?"*
  * **Mengarahkan konsensus**: *"Bagaimana jika kita gunakan Ash untuk core resource, tapi tetap pakai Ecto query custom untuk reporting?"*
* Tokoh-tokoh akan menanggapi arahan Anda sekaligus saling menguji argumen rekan dewan (*cross-examination*).
* ⛔ **Aturan Ketat**: Berkas risalah **BELUM** ditulis ke disk selama sidang berstatus terbuka.

### Tahap 3: Penutupan Sidang & Dokumentasi Resmi (The Verdict)
* Ketika Anda merasa musyawarah telah matang, ketuk palu penutupan sidang dengan salah satu perintah:
  ```bash
  /ompimpa:balairung --close
  # Atau ketik di chat: "Tutup sidang balairung dan catat mufakatnya"
  ```
* Koordinator Balairung akan merangkum seluruh hasil sidang dan mencatatnya ke dalam dokumen risalah permanen.

---

## 3. Struktur Berkas Risalah Balairung

Dokumen risalah dibuat **hanya saat sidang resmi ditutup**, disimpan di:
📁 **`_ompimpa/balairung/BALAIRUNG-[YYYYMMDD-HHMM]-[slug].md`**

Berkas ini memuat:
- **Ringkasan Topik & Batasan Masalah**.
- **Posisi Awal & Intervensi Ketua Sidang**.
- **Dialektika & Debat Silang Utama**.
- **Tabel Inventaris Modul & Rute/Berkas (Wajib — Invarian INV-10)**:
  Risalah wajib memuat seksi heading `## Inventaris` berisi tabel Markdown dengan kolom modul, rute/berkas, dan komponen:
  ```markdown
  ## Inventaris
  | Modul | Rute Index | Rute New | Rute Edit | Komponen |
  | :--- | :--- | :--- | :--- | :--- |
  | Accounts | `/users` | `/users/new` | `/users/:id/edit` | UserLive |
  ```
  *Tanpa tabel ini, sidang belum boleh diketuk palu dan gerbang `ompimpa inventory` akan menolak PRD.*
- **Verdict Akhir**:
  - Rekomendasi Mufakat.
  - Suara Minoritas (*Dissenting Opinions*).
  - Batas Pembatalan Keputusan (*Kill Criteria*).
  - Rekomendasi Tindak Lanjut (misal: menyusun `/ompimpa:adr` atau `/ompimpa:prd`).

## 4. Memvalidasi Gerbang Inventaris (`bin/ompimpa inventory`)

Sebelum melangkah dari Balairung ke PRD, jalankan verifikasi gerbang mekanis INV-10:
```bash
bin/ompimpa inventory --balairung _ompimpa/balairung/BALAIRUNG-20260902-panen-agyimpa.md --prd _ompimpa/prd/PRD-001-panen-agyimpa.md
```
Gerbang ini memverifikasi bahwa:
1. Risalah Balairung memuat tabel inventaris lengkap.
2. Dokumen Master PRD mencakup 100% modul yang telah dimufakatkan di Balairung tanpa pemotongan ruang lingkup sepihak (*anti scope-truncation*). Modul yang ditunda wajib disertai *Scope Deferral Record*.

## 5. Memanfaatkan Hasil Balairung di Workflow Lain

Berkas risalah Balairung adalah **dokumen rujukan bebas (*Independent Reference Artifact*)**:
* Saat menyusun PRD: `/ompimpa:prd "Sistem Multi-Tenant"` wajib merujuk ke risalah Balairung terkait dan mengadopsi tabel inventarisnya.
* Saat menyusun ADR: `/ompimpa:adr "Keputusan Ash vs Ecto"` dapat langsung mengutip argumen dan *kill criteria* dari Balairung.
* Saat koding di `/ompimpa:dev`: Spesialis backend mematuhi invariant yang telah dimufakatkan di Balairung.
