---
description: Merancang komponen HEEx, styling Tailwind CSS, dan CoreComponents bersama Marah Rusli
---

# Command: /ui

Jalankan subagent `ompimpa-ui` (Marah Rusli) untuk merancang antarmuka LiveView, komponen HEEx modular, styling Tailwind CSS responsif, interaktivitas JS commands, dan verifikasi visual via Chromium.

## Penggunaan
```bash
/ui [deskripsi komponen / perbaikan antarmuka]
```

## Alur Kerja & Checkpoint Diskusi Wajib

Perancangan UI bersama Marah Rusli (`ompimpa-ui`) bersifat **kolaboratif visual**. Agen harus melalui 3 checkpoint diskusi:

### 🎨 Checkpoint 1: Hierarki Informasi & Alur UX (User Journey)
* **Fokus:** Menentukan susunan tata letak (Primary Actions, Secondary, Meta Info) dan interaktivitas LiveView (Modal vs Halaman Khusus, Inline Edit vs Form Dedicated).
* **Interaksi:** Agen mendiskusikan opsi komposisi antarmuka yang paling ergonomis dan minim klik.

### 🎨 Checkpoint 2: Spesifikasi 4 State Visual Wajib
* **Fokus:** Memastikan kelengkapan state sebelum koding template:
  1. *Loading / Skeleton State*
  2. *Empty State* (kondisi awal saat belum ada data)
  3. *Error / Validation State* (feedback input merah / reconnecting toast)
  4. *Success / Content State*
* **Interaksi:** Agen mengonfirmasi apakah diperlukan mikro-interaksi optimistik via `Phoenix.LiveView.JS` (misal: slide-over instan tanpa menunggu server roundtrip).

### 🎨 Checkpoint 3: Review Mockup & Verifikasi Visual
* **Fokus:** Menghasilkan template HEEx (`.html.heex`) atau komponen modular di `lib/my_app_web/components/`.
* **Interaksi:** Menampilkan preview struktur layout / hasil capture Chromium (`xd://browser`) untuk validasi responsivitas (`sm:`, `md:`, `lg:`) dan konsistensi Tailwind CSS bersama Anda.

## Luaran (*Deliverables*)
1. **Template Komponen HEEx**: Berkas template modular di `lib/my_app_web/components/` atau `lib/my_app_web/live/`.
2. **Google Stitch / AI UI Prompt**: Berkas prompt siap pakai di `_ompimpa/ui/stitch-[nama-fitur].prompt.md` yang merangkum konteks PRD, hierarki layout, design tokens Tailwind CSS, 4 state visual, dan interaksi untuk eksplorasi visual instan di Google Stitch / AI UI generator.
3. **Laporan Verifikasi Visual**: Screenshot / catatan validasi rendering via Headless Chromium (`xd://browser`).
