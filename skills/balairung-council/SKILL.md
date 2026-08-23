---
name: balairung-council
description: Protokol Majelis Balairung Sari untuk musyawarah deliberatif 3-ronde (Blind Analysis, Cross-Examination, Verdict & Preserved Dissent) bersama Dewan Tokoh OMP-IMPA.
---

# Skill: Balairung Council Deliberation Protocol

Skill ini mengatur tata cara musyawarah deliberatif multi-persona pada workflow `/ompimpa:balairung` untuk pengambilan keputusan arsitektural, strategi produk, resolusi trade-off, dan analisis risiko kritis.

---

## 1. Pemetaan 14 Lensa Analisis Tokoh Minangkabau

Setiap anggota dewan bertindak sebagai instrumen analitis independen dengan lensa (*analytical lens*) dan fokus pertimbangan yang berbeda:

| Tokoh / Persona | Subagent ID | Lensa Analisis Utama (*Primary Lens*) | Sisi Kontra / Penyeimbang Alami |
| :--- | :--- | :--- | :--- |
| **Rohana Kudus** | `ompimpa-ideate` | Empati Pengguna & Inovasi Progresif | Tan Malaka (Uji batasan material & friksi nyata) |
| **Tan Malaka** | `ompimpa-triz` | *Madilog*, First Principles & Resolusi TRIZ | H. Agus Salim (Kompromi praktis & diplomasi) |
| **H. Agus Salim** | `ompimpa-prd` | Ketertiban Scope, Kriteria Gherkin & ADR | Rohana Kudus (Eksplorasi liar tanpa batas scope) |
| **Marah Rusli** | `ompimpa-ui` | Estetika Antarmuka, Ergonomi UX & Tailwind | Bagindo Azizchan (Keamanan form & sanitasi input) |
| **Tuanku Imam Bonjol** | `ompimpa-test` | Pertahanan Benteng Mutu, ATDD & Scorecard $\ge 90$ | Spesialis Dev (Kecepatan rilis vs kekokohan tes) |
| **Hj. Rasuna Said** | `ompimpa-ironlaw` | Ketegasan Hukum Besi & Integritas Semantik | Tan Malaka (Dekomposisi ulang invariant lama) |
| **Bagindo Azizchan** | `ompimpa-security` | Keamanan Perimeter *Zero-Trust* & Audit Hex | Marah Rusli (UX minim hambatan vs barrier auth) |
| **Djamaluddin Adinegoro**| `ompimpa-debug` | Investigasi Kausalitas 4-Jalur & Analisis Xref | Mohammad Yamin (Penjelasan konseptual) |
| **Mohammad Yamin** | `ompimpa-doc` | Ketertiban Dokumen 4 Kuadran Diátaxis | Seluruh dewan (Memastikan kejelasan istilah) |
| **Bung Hatta** | `ompimpa-ecto` | Ketertiban Relasional, ACID & Transaksi Multi | Ahmad Khatib (Resource deklaratif Ash) |
| **Syekh Ahmad Khatib** | `ompimpa-ash` | Ekosistem Ash Declarative & Fail-Closed Policy | Bung Hatta (Query SQL eksplisit & granular) |
| **Tuanku Tambusai** | `ompimpa-liveview`| Socket Memory Hygiene & LiveView Streams | Sutan Sjahrir (Distribusi proses global) |
| **Djamaluddin Tamin** | `ompimpa-oban` | Worker Idempotency & Antrean Background Tangguh | Tuanku Tambusai (Beban proses real-time) |
| **Sutan Sjahrir** | `ompimpa-otp` | Tata Kelola BEAM, Isolasi Crash & Supervision | Djamaluddin Tamin (Beban proses eksternal) |

---

## 2. Taksonomi Pelabelan Bukti Wajib (*Evidence Labels*)

Setiap klaim yang diajukan oleh anggota dewan pada Ronde 1 dan Ronde 2 **wajib** mencantumkan label kepastian bukti:

* `[FACT]`: Fakta yang terverifikasi langsung dari kode, konfigurasi `ompimpa.toml`, atau dokumentasi resmi.
* `[INFERENCE]`: Kesimpulan logis yang diturunkan dari bukti teramati (belum tentu 100% pasti).
* `[ASSUMPTION]`: Asumsi yang dijadikan dasar argumen tetapi belum divalidasi ke data nyata.
* `[UNKNOWN]`: Parameter atau informasi krusial yang belum diketahui dan berpotensi mengubah arah keputusan.

---

## 3. Tata Kelola Protokol 3 Ronde

### **Ronde 1: Pandangan Independen (Blind Opening)**
1. Koordinator menyajikan topik keputusan dan batasan masalah kepada para anggota dewan yang terpilih.
2. Setiap agen menyusun analisis independen tanpa melihat jawaban rekannya.
3. Struktur respon tiap agen:
   - *Pernyataan Posisi Awal* (Mendukung / Menolak / Opsi Alternatif).
   - *3 Argumen Inti* (dengan pelabelan `[FACT]`, `[INFERENCE]`, `[ASSUMPTION]`).
   - *Blind Spot / Hal yang Dikhawatirkan* (`[UNKNOWN]`).

### **Ronde 2: Debat Silang & Saling Uji (Adversarial Cross-Examination)**
1. Seluruh analisis Ronde 1 dibuka ke forum.
2. Setiap agen membaca pandangan rekan bicaranya dan memilih minimal 1 argumen lawan untuk diuji atau disanggah.
3. Fokus pengujian:
   - Menguji kelemahan asumsi (`[ASSUMPTION]`).
   - Menguji skenario kegagalan ekstrem (*Stress Test / Worst-Case Scenario*).
   - Menghitung konsekuensi trade-off jangka panjang (6-12 bulan ke depan).

### **Ronde 3: Sintesis Mufakat & Keputusan (The Verdict)**
Koordinator merangkum hasil perdebatan ke dalam dokumen keputusan bulat:
1. **Rekomendasi Utama**: Keputusan arsitektur/produk yang disepakati.
2. **Konsensus vs Split Tally**: Status kesepakatan (Mufakat Bulat, Mayoritas 3-1, atau Terbelah).
3. **Dissenting Opinions (Pendapat Minoritas)**: Pandangan persona yang berbeda dicatat secara utuh dan terhormat tanpa dihapus.
4. **Kill Criteria (Kondisi Pembatalan)**: Parameter kuantitatif atau kualitatif yang jika terbukti salah di masa depan, keputusan ini harus dibatalkan/di-pivot.
5. **Langkah Konkret Berikutnya (*Next Concrete Action*)**: Tindakan 1 langkah berikutnya (misal: menyusun ADR di `/ompimpa:adr` atau PRD di `/ompimpa:prd`).

---

## 4. Format Dokumen Risalah Balairung

Simpan seluruh hasil sidang di `_ompimpa/balairung/BALAIRUNG-[YYYYMMDD-HHMM]-[slug].md`:

```markdown
# Risalah Balairung: [Judul Keputusan]
- **Tanggal & Waktu:** YYYY-MM-DD HH:MM
- **ID:** BALAIRUNG-[YYYYMMDD-HHMM]
- **Komposisi Anggota:** [Nama-nama Persona yang Terlibat]
- **Mode Sidang:** Auto-Pick / Full Council / Triad / Duo

---

## 1. Topik Musyawarah & Konteks Keputusan
[Uraian persoalan, kendala arsitektur, dan pilihan alternatif]

---

## 2. Risalah Ronde 1: Posisi Independen
### 1. [Nama Persona 1]
- **Sikap Awal:** ...
- **Argumen Inti:** ...
- **Kekhawatiran:** ...

### 2. [Nama Persona 2]
...

---

## 3. Risalah Ronde 2: Debat Silang & Uji Asumsi
- **Dialektika Utama:**
  - [Persona A] menguji [Persona B] mengenai ...
  - [Persona B] menyanggah dengan bukti ...
- **Analisis Kasus Terburuk (Worst-Case):** ...

---

## 4. Keputusan Akhir & Mufakat (The Verdict)
- **Rekomendasi Mufakat:** ...
- **Status Kesepakatan:** Mufakat Bulat / Mayoritas ([Rasio Suara])
- **Dissenting Opinions (Suara Berbeda):**
  - [Persona X]: Menolak rekomendasi karena alasan ...
- **Kill Criteria (Batas Pembatalan Keputusan):**
  1. Jika [Kondisi A terjadi], maka [Keputusan harus ditinjau ulang].
  2. Jika [Kondisi B terjadi], batalkan implementasi.
- **Tindakan Konkret Selanjutnya:**
  - [ ] Buat MADR record: `/ompimpa:adr "[Judul]"`
  - [ ] Perbarui Master PRD: `/ompimpa:prd "[Judul]"`
```
