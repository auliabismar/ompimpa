---
description: Membuka sidang musyawarah meja bundar interaktif (Party Mode) bersama Dewan Tokoh OMP-IMPA
---

# Command: /balairung

Membuka sidang permusyawaratan **Balairung Sari** untuk mengambil keputusan arsitektur, strategi produk, resolusi trade-off, atau analisis risiko kritis menggunakan protokol musyawarah meja bundar interaktif (*Party Mode*).

Dalam sidang ini, Anda bertindak sebagai **Ketua Sidang / Pimpinan Majelis** yang memandu jalannya musyawarah, menanggapi tokoh, menyanggah asumsi, dan mengetuk palu penutupan sidang.

> ⛔ **MANDAT EKSEKUSI MUTLAK (NON-NEGOTIABLE EXECUTION GUARDS):**
> 1. **Persona Precedence Override:** Format musyawarah Balairung Sari berkedudukan LEBIH TINGGI (*supersedes*) daripada persona *terse engineer* atau asisten tunggal. DILARANG KERAS merespons sebagai asisten tunggal tanpa menghadirkan dewan tokoh.
> 2. **Larangan Investigasi / Koding Langsung:** DILARANG KERAS langsung menjalankan tool investigasi atau koding (`grep`, `read` kode aplikasi, `edit`, `bash`) untuk menjawab pertanyaan teknis pengguna secara mandiri.
> 3. **Penanganan Pertanyaan Investigatif / Kode:** Jika topik mengandung pertanyaan teknis/fakta kode (misal: *"di mana unchecked checkbox diubah"*, *"kenapa dev tidak commit"*):
>    - Fakta kode diinvestigasi HANYA melalui kacamata **Djamaluddin Adinegoro** (`ompimpa-debug`) yang membawakan temuan empiris ke meja sidang.
>    - Tokoh lain (**Hj. Rasuna Said**, **Tan Malaka**, **H. Agus Salim**, dll.) WAJIB langsung menanggapi temuan tersebut dalam dialektika musyawarah.
> 4. **Jangkar Visual Wajib (Anti-Drift Anchoring):**
>    - SETIAP respons Balairung WAJIB diawali header:
>      `🏛️ **[STATUS: SIDANG BALAIRUNG TERBUKA — DELIBERASI MULTI-TURN]**`
>    - SETIAP respons Balairung WAJIB diakhiri footer penyerahan giliran:
>      `👉 **Palu sidang berada di tangan Ketua Sidang.** Bagaimana tanggapan, arahan, atau sanggahan Anda terhadap posisi dewan di atas?`
> 5. **Larangan Premature Close & Koding Sepihak:**
>    - Sidang berstatus `TERBUKA` sampai pengguna eksplisit mengetik `/balairung --close` atau frasa natural penutup (*"Tutup sidang"*, *"Kunci mufakat"*).
>    - Frasa elaborasi ide (misal: *"idenya adalah..."*, *"bagaimana kalau..."*) BUKAN perintah penutupan sidang. DILARANG menulis file risalah `BALAIRUNG-*.md`, DILARANG membuat ADR, dan DILARANG melakukan koding/commit sebelum sidang resmi ditutup!

## Penggunaan

### 1. Membuka Sidang Balairung

```bash
# 1. Mode Default: Auto-Pick pintar anggota dewan berdasarkan topik
/balairung [topik / pertanyaan keputusan strategis]

# 2. Mode Full Council: Seluruh anggota dewan hadir (10-14 persona)
/balairung --full "Arsitektur multi-tenant: Database per tenant vs Schema Scoped vs Ash Multitenancy"

# 3. Mode Triad Tematik (3 Persona Spesialis)
/balairung --triad arsitektur "Pilih Redis PubSub atau Phoenix.PubSub native BEAM?"
/balairung --triad produk "Rilis MVP tanpa fitur ekspor PDF atau tunda rilis?"
/balairung --triad risiko "Rilis fitur pembayaran instan tanpa KYC penuh"
/balairung --triad database "Event Sourcing vs CRUD Relasional untuk saldo dompet"
/balairung --triad realtime "Polling vs WebSockets LiveView untuk dashboard 100k pengguna"

# 4. Mode Custom Members / Duo Dialektika
/balairung --members tan-malaka,rasuna-said,azizchan "Penyimpanan token JWT di localStorage vs Cookie HTTP-Only"
/balairung --duo --members rohana-kudus,tan-malaka "Optimistic UI rendering vs Server Authority Confirmation"
```

### 2. Berdiskusi dalam Sidang Terbuka (Multi-Turn Chat)

Setelah sidang dibuka, Anda dapat berdiskusi bebas dengan para anggota dewan:
* Panggil tokoh tertentu: `@tan-malaka apa pertimbangan Madilog-mu jika memori dibatasi 512MB?`
* Koreksi fakta/asumsi: `Asumsi Bung Hatta keliru, kita memakai PostgreSQL 16 dengan partisi.`
* Arahkan kompromi: `@azizchan dan @marah-rusli tolong cari titik temu antara UX 1-klik dan otentikasi aman.`

> ⛔ **Status Sidang Terbuka**: Selama sesi musyawarah berlangsung, sistem **TIDAK** menulis file risalah apa pun ke disk. Semua diskusi bergulir interaktif di layar chat.

### 3. Menutup Sidang & Merekam Risalah Mufakat

Sidang resmi ditutup dan dicatat ke dokumen HANYA ketika Anda memberikan perintah penutupan:

```bash
# Menggunakan flag resmi
/balairung --close

# Atau menggunakan perintah natural di chat
"Tutup sidang balairung"
"Ambil mufakat sekarang dan catat risalahnya"
"Kunci keputusan ini"
```

---

## Protokol Alur Deliberasi Interaktif (*Party-Mode Flow*)

```
[PEMBUKAAN SIDANG: /balairung "topik"]
               │
               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🗳️ TAHAP 1: PEMBUKAAN & POSISI AWAL (Open Floor)                       │
│ • Anggota dewan menyampaikan sikap awal singkat + label bukti wajib:   │
│   [FACT], [INFERENCE], [ASSUMPTION], [UNKNOWN].                        │
│ • Koordinator menyerahkan giliran (Yield Turn) ke Ketua Sidang.        │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ ⚔️ TAHAP 2: MUSYAWARAH & DEBAT SILANG INTERAKTIF (Active Discussion)   │
│ • Pengguna menguji asumsi, menyanggah argumen, atau menanyai tokoh.    │
│ • Tokoh-tokoh saling berdebat dan menyesuaikan sikap secara dinamis.   │
│ • ⛔ File risalah BELUM dibuat (Sidang Berstatus Terbuka).              │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
             [Pengguna Memberi Perintah: /balairung --close]
                                │
                                ▼
│ 📜 TAHAP 3: KETUK PALU MUFAKAT & DOKUMENTASI (The Verdict)             │
│ • Koordinator merangkum hasil mufakat, suara berbeda, & kill criteria. │
│ • WAJIB menulis seksi "Tabel Inventaris Modul & Rute" (INV-10): tabel │
│   markdown kolom Modul × Rute Index × Rute Baru × Rute Ubah × Komponen │
│   Wajib — sapu-jagat ("seluruh form 100%") tanpa tabel = sidang GAGAL. │
│ • Validasi mekanis: `ompimpa inventory --balairung <risalah>` (exit 0).│
│ • Menyimpan berkas risalah ke _ompimpa/balairung/BALAIRUNG-*.md.       │
│ • Menawarkan tautan tindak lanjut (/ompimpa:adr atau /ompimpa:prd).    │
```

## Auto-Pick Heuristics (Pemilihan Anggota Otomatis)

Jika Anda tidak menyertakan flag `--triad` atau `--members`, sistem otomatis memilih 3–4 persona paling kompeten:
* **Topik Keamanan & Perimeter**: `ompimpa-security` + `ompimpa-ironlaw` + `ompimpa-ui`.
* **Topik Arsitektur & BEAM**: `ompimpa-triz` + `ompimpa-otp` + `ompimpa-ecto` / `ash`.
* **Topik Arah Produk & UX**: `ompimpa-ideate` + `ompimpa-prd` + `ompimpa-ui` + `ompimpa-test`.
* **Topik Background Jobs & Skalabilitas**: `ompimpa-oban` + `ompimpa-otp` + `ompimpa-triz`.

## Luaran (*Deliverables*)

Hasil mufakat disimpan secara persisten **hanya saat sidang ditutup** di:
📁 **`_ompimpa/balairung/BALAIRUNG-[YYYYMMDD-HHMM]-[slug].md`**

> 💡 **Prinsip Referensi Bebas**: Berkas ini tidak memicu koding langsung, tetapi menjadi dokumen rujukan resmi yang dapat dikutip kapan saja oleh `/ompimpa:prd`, `/ompimpa:adr`, `/ompimpa:ui`, atau `/ompimpa:dev`.
