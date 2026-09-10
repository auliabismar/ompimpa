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
| **Bung Hatta** | `ompimpa-ecto` | Ketertiban Relasional, ACID & Transaksi Multi | Mr. Assaat (Resource deklaratif Ash) |
| **Mr. Assaat** | `ompimpa-ash` | Ekosistem Ash Declarative & Fail-Closed Policy | Bung Hatta (Query SQL eksplisit & granular) |
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

## 3. Protokol Deliberasi Interaktif (Party-Mode Deliberation State Machine)

Sidang Balairung Sari beroperasi sebagai **Musyawarah Meja Bundar Multi-Turn Interaktif** (mengadopsi arsitektur *BMAD Party Mode*). Pengguna bertindak sebagai **Ketua Sidang / Pimpinan Majelis** yang memegang palu sidang dan berhak mengarahkan, menguji, maupun menengahi jalannya debat.

```
[PEMBUKAAN SIDANG: /balairung "topik"]
               │
               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🏛️ TAHAP 1: PEMBUKAAN SIDANG & POSISI AWAL (Blind Opening & Open Floor) │
│ • Koordinator mendudukkan anggota dewan yang relevan.                 │
│ • Setiap tokoh menyampaikan posisi awal ringkas + label bukti wajib.   │
│ • Koordinator WAJIB YIELD TURN ke Pengguna (Ketua Sidang).             │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ ⚔️ TAHAP 2: DEBAT SILANG & DIALOG MULTI-TURN (Active Deliberation)      │
│ • Pengguna menyanggah asumsi, bertanya ke @tokoh, atau beri kendala.  │
│ • Tokoh merespons input pengguna & saling menguji argumen rekan.       │
│ • ⛔ HARD RULE: STATUS SIDANG TERBUKA. DILARANG MENULIS FILE KE DISK.   │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
             [Pengguna Memerintahkan Tutup Sidang:
            /balairung --close / "Tutup Sidang"]
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 📜 TAHAP 3: PENUTUPAN SIDANG & RISALAH MUFAKAT (The Verdict & Doc)     │
│ • Koordinator mengetuk palu sidang dan merangkum seluruh hasil debat. │
│ • Menulis dokumen permanen ke _ompimpa/balairung/BALAIRUNG-*.md.       │
│ • Menawarkan 1 langkah konkret berikutnya (ADR / PRD).                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

### **Aturan Siklus Turn-by-Turn**

#### **Turn 1: Pembukaan Sidang (Open Floor)**
1. Koordinator memetakan topik dan mendudukkan 3–4 tokoh (atau sesuai flag `--full`, `--triad`, `--members`).
2. Masing-masing tokoh memaparkan pandangan ringkas (2–3 poin padat):
   - *Pernyataan Sikap* (Mendukung / Menolak / Alternatif).
   - *Argumen Kunci* (berlabel `[FACT]`, `[INFERENCE]`, `[ASSUMPTION]`).
   - *Kekhawatiran / Blind Spot* (`[UNKNOWN]`).
3. **Wajib Yield Turn**: Di akhir turn pertama, koordinator menyimpulkan titik gesekan utama antar-tokoh dan secara eksplisit menyerahkan giliran bicara kepada Pengguna sebagai Ketua Sidang:
   > *"Sidang Balairung Sari resmi dibuka. Terdapat benturan pandangan antara [Tokoh A] dan [Tokoh B] mengenai [Asumsi/Topik]. Bagaimana pandangan atau arahan Ketua Sidang?"*

#### **Turn 2..N: Musyawarah Terbuka (Active Deliberation)**
1. Pengguna dapat memberikan tanggapan bebas di chat:
   - Meminta pendalaman dari persona tertentu: `@tan-malaka`, `@bung-hatta`, `@azizchan`.
   - Mengoreksi data/asumsi faktual: *"Asumsi memori keliru, kita punya RAM 16GB."*
   - Mengarahkan kompromi atau prioritas bisnis: *"Prioritaskan time-to-market 2 pekan."*
2. Tokoh-tokoh yang dipanggil atau relevan langsung merespons tanggapan pengguna dan saling berargumen (*cross-examination*).
3. **Larangan Keras (*Hard Invariant*)**: Selama tahap ini, sidang berstatus `[STATUS: SIDANG TERBUKA]`. Agen **DILARANG KERAS** membuat file risalah markdown di disk sampai ada instruksi tutup sidang.

#### **Turn Final: Penutupan Sidang & Dokumentasi (Explicit Close)**
Sidang **hanya dicatat ke berkas dokumen** jika pengguna memberikan perintah penutupan secara eksplisit:
- Command: `/balairung --close` atau `/balairung close`
- Frasa natural: *"Tutup sidang"*, *"Akhiri balairung"*, *"Ambil mufakat sekarang"*, *"Kunci keputusan dan buat risalahnya"*.

Ketika perintah tutup diterima, Koordinator Balairung:
1. Merumuskan **Rekomendasi Mufakat** berdasarkan seluruh alur diskusi (termasuk suara dan arahan Ketua Sidang).
2. Menyusun **Status Kesepakatan (Consensus vs Split Tally)**.
3. Menjaga dan mencatat **Dissenting Opinions (Pendapat Minoritas)** secara utuh.
4. Menetapkan **Kill Criteria (Batas Pembatalan Keputusan)**.
5. Menulis seluruh risalah ke berkas permanen:
   📁 `_ompimpa/balairung/BALAIRUNG-[YYYYMMDD-HHMM]-[slug].md`
6. Memberikan 1 rekomendasi langkah tindak lanjut (misal: menyusun `/ompimpa:adr` atau `/ompimpa:prd`).

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

---

## Sequential-Thinking (Wajib Trigger-Based)
Pemicu WAJIB (≥1 terpenuhi):
1. Solusi multi-langkah ≥3 langkah.
2. Scope awal belum jelas / arah bisa berubah.
3. Ada trade-off/kontradiksi atau ≥2 opsi nyata.
4. Butuh hipotesis + verifikasi / revisi arah.
5. Perlu menyaring info irrelevan lintas sumber.

Cara pakai:
WAJIB memakai tool sequential-thinking bila ≥1 pemicu di atas terpenuhi. Tulis JSON ke xd://mcp__sequential_thinking_sequentialthinking (thought, nextThoughtNeeded, thoughtNumber, totalThoughts; revisi via isRevision/revisesThought, cabang via branchFromThought/branchId). Hasilkan satu hipotesis, verifikasi terhadap langkah berpikir, ulangi sampai puas; nextThoughtNeeded:false hanya saat jawaban final tercapai. Fokus: tiap tokoh jalankan thinking sebelum posisi Ronde 1 bila argumen mengandung trade-off/[UNKNOWN]; debat silang memakai revisi, verdict memverifikasi hipotesis mufakat.
