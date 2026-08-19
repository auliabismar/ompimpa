# Penjelasan: Arsitektur Tripartit OMP-IMPA

Dokumen penjelasan (*Understanding-Oriented*) ini membedah alasan arsitektur, filosofi, dan keuntungan di balik penggabungan **BMAD**, **phxagents**, dan **OMP Native Engine**.

---

## 1. Latar Belakang Masalah (The Disconnect in AI Coding)

Sebelum OMP-IMPA lahir, ada jurang besar dalam rekayasa perangkat lunak berbasis AI:
1. **Prompt Lepas Tanpa Disiplin Produk**: AI langsung menulis kode tanpa PRD, tanpa analisis kontradiksi, dan tanpa spesifikasi batas yang jelas (mengakibatkan halusinasi dan arsitektur melenceng).
2. **Ketiadaan Keahlian Khusus BEAM**: AI umum menulis kode Elixir dengan mentalitas bahasa OOP (seperti membuat mutable state atau loop procedural yang tidak efisien).
3. **Pengujian yang Terabaikan**: Tes baru ditulis setelah kode selesai, sering kali hanya berupa mock kosong tanpa menguji skenario kegagalan nyata.

---

## 2. Tiga Pilar Solusi OMP-IMPA

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. BMAD METHOD (BMM + CIS + TEA)                                                               │
│    • CIS: Musyawarah kreatif meja bundar (Rohana Kudus & Tan Malaka).                          │
│    • BMM: Penguncian spesifikasi Master PRD & MADR ADR sebelum baris kode pertama ditulis.      │
│    • TEA: Perancangan matriks risiko P1-P4 dan scaffolding tes merah Red-Phase ATDD.           │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. PHXAGENTS & 26 IRON LAWS                                                                    │
│    • Spesialis domain Elixir/Phoenix (Ash, LiveView, Ecto, Oban, OTP).                         │
│    • 26 Hukum Besi non-negotiable yang mencegah kegagalan fatal (uang float, socket unauth).   │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. OH MY PI (OMP) NATIVE HARNESS                                                               │
│    • Konkurensi subagent paralel (task DAG) hingga 32 agen.                                    │
│    • Isolasi sandbox via Git Worktrees.                                                        │
│    • Bukti verifikasi visual runtime via Headless Chromium (xd://browser).                     │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mengapa Sintesis Ini Sangat Kuat?
- **Disiplin di Awal (Pre-Dev)**: PRD dan ATDD mengunci ekspektasi sistem secara matematis.
- **Eksekusi Presisi di Tengah (Dev)**: Spesialis menulis kode yang mematuhi idiom BEAM di worktree terisolasi.
- **Verifikasi Absolut di Akhir (Proof)**: Kode hanya dianggap selesai jika lulus 26 Hukum Besi, compiler warnings-as-errors, dan 100% tes hijau.
