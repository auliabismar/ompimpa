---
description: Memulai sesi curah pendapat (SCAMPER, Empathy Map, TRIZ) bersama Rohana Kudus & Tan Malaka
---

# Command: /ideate

Jalankan subagent `ompimpa-ideate` (Rohana Kudus) untuk membedah ide fitur baru, menggali kebutuhan pengguna, dan merumuskan How Might We (HMW) statements.

Jika terdapat kontradiksi atau trade-off teknis yang sulit, libatkan juga subagent `ompimpa-triz` (Tan Malaka).

## Penggunaan
```bash
/ideate [deskripsi ide / masalah produk]
```

## Alur Kerja & Checkpoint Diskusi Wajib

Sesi `/ompimpa:ideate` adalah **musyawarah interaktif**. Agen DILARANG langsung melompat ke koding atau membuat PRD tanpa melewati 4 checkpoint diskusi berikut:

### 💬 Checkpoint 1: Persona & Empathy Mapping (Klarifikasi Pengguna)
* **Fokus:** Menggali profil persona nyata, kecemasan pengguna (*Says, Thinks, Does, Feels*), dan friksi terbesar yang ingin dihilangkan.
* **Interaksi:** Agen mengajukan 2–3 pertanyaan terarah mengenai ekspektasi audiens target.

### 💬 Checkpoint 2: SCAMPER & Reverse Brainstorming (Eksplorasi Alternatif)
* **Fokus:** Menimbang sudut pandang inovasi (*Substitute, Combine, Adapt, Eliminate, Reverse*).
* **Interaksi:** Agen memaparkan skenario ekstrem (*"Bagaimana jika jaringan terputus / beban naik 100x?"*) dan mendiskusikan opsi fitur yang layak dipangkas (*weightless code*).

### 💬 Checkpoint 3: TRIZ Contradiction & Trade-Off Resolution (Resolusi Benturan)
* **Fokus:** Bersama Tan Malaka (`ompimpa-triz`), mengidentifikasi kontradiksi teknis (contoh: *latensi real-time vs beban memori*, *kemudahan vs isolasi tenant ketat*).
* **Interaksi:** Agen menyajikan alternatif prinsip pemisahan (*Time, Space, Condition*) untuk disepakati bersama Anda.

### 💬 Checkpoint 4: Konvergensi & Persetujuan Matriks Ideasi (Handoff PRD)
* **Fokus:** Merumuskan Matriks Ideasi (3–5 ide teratas dengan skor *Impact vs Effort*) dan pernyataan HMW (*How Might We*).
* **Interaksi:** Meminta persetujuan final Anda sebelum menyimpan artefak ke `_ompimpa/ideation/IDEATION-[ID].md`.
