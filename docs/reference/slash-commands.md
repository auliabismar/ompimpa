# Referensi: Daftar Perintah Cepat (*Slash Commands*)

Dokumen referensi (*Information-Oriented*) ini memuat daftar lengkap perintah slash command yang tersedia di OMP-IMPA beserta sintaks, opsi, dan agen penanggung jawabnya.

---

## Tabel Ringkasan Perintah

| Perintah | Deskripsi | Subagent Penanggung Jawab | Contoh Penggunaan |
| :--- | :--- | :--- | :--- |
| **`/ompimpa:ideate`** | Musyawarah ideasi & resolusi kontradiksi TRIZ | `ompimpa-ideate` & `ompimpa-triz` | `/ompimpa:ideate [ide]` |
| **`/ompimpa:prd`** | Menyusun Master PRD & Epics Spine | `ompimpa-prd` | `/ompimpa:prd [judul]` |
| **`/ompimpa:adr`** | Mencatat keputusan arsitektur MADR 3.0+ | `ompimpa-prd` | `/ompimpa:adr [judul]` |
| **`/ompimpa:ui`** | Merancang HEEx, Tailwind, & CoreComponents | `ompimpa-ui` | `/ompimpa:ui [nama-komponen]` |
| **`/ompimpa:atdd`** | Merancang matriks risiko & tes merah Red-Phase | `ompimpa-test` | `/ompimpa:atdd [story]` |
| **`/ompimpa:dev`** | Loop koding otonom berbasis disk state | Spesialis Backend | `/ompimpa:dev [--auto]` |
| **`/ompimpa:course-correct`** | Kalibrasi ulang PRD & rencana saat pivot | `ompimpa-prd` & `ompimpa-triz` | `/ompimpa:course-correct [kendala]` |
| **`/ompimpa:review`** | Panel review paralel 4-jalur | `ompimpa-ironlaw` & Security | `/ompimpa:review [--staged]` |
| **`/ompimpa:verify`** | Strict compiler & ExUnit test suite | `ompimpa-verify` | `/ompimpa:verify` |
| **`/ompimpa:doc`** | Menyusun panduan Diátaxis User/Admin/Dev | `ompimpa-doc` | `/ompimpa:doc <user\|admin\|dev>` |
| **`/ompimpa:audit`** | Audit kesehatan arsitektur, N+1, & Hex | `ompimpa-audit` | `/ompimpa:audit` |
| **`/ompimpa:techdebt`** | Pemindaian Credo & hutang teknis | `ompimpa-techdebt` | `/ompimpa:techdebt` |
| **`/ompimpa:compound`** | Menyimpan pola solusi ke memori proyek | `ompimpa-compound` | `/ompimpa:compound [topik]` |
| **`/ompimpa:doctor`** | Diagnosa toolchain & konfigurasi repo | CLI Engine | `/ompimpa:doctor` |
