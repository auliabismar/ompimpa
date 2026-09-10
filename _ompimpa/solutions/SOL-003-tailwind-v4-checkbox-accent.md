---
id: SOL-003
topic: tailwind-v4-checkbox-accent
tags: [tailwind, css, ui, checkbox, accent-color]
stack: [frontend, tailwindcss, heex]
date: 2026-09-08
---

# Solusi SOL-003: Pewarnaan Checkbox di Tailwind CSS v4 Wajib `accent-*`

## Gejala & Masalah
Elemen kotak centang (`<input type="checkbox">`) di peramban modern (Chrome/Edge/Firefox) tetap berwarna hitam pekat default sistem operasi meskipun diberi kelas Tailwind `text-sky-600` atau `text-primary`.

## Akar Penyebab (Root Cause)
Di Tailwind CSS v4, styling kontrol form bawaan browser memanfaatkan properti CSS native `accent-color`. Kelas utilitas `text-sky-600` hanya mengubah properti `color` (teks), yang tidak memengaruhi warna tanda centang dan kotak input form native browser.

## Pola Solusi yang Terbukti (Proven Fix)
Tambahkan utilitas semantik `accent-*` pada seluruh checkbox:

```heex
<%!-- SEBELUM: Checkbox tetap hitam di browser modern --%>
<input type="checkbox" class="h-4 w-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500" />

<%!-- SESUDAH: Warna aksen biru sky aktif sempurna --%>
<input type="checkbox" class="h-4 w-4 rounded border-zinc-300 accent-sky-600 focus:ring-sky-500" />
```

## Invariant Pencegahan Regresi
1. Seluruh komponen CoreComponents (`<.input type="checkbox">`) dan checkbox mentah wajib menyertakan kelas `accent-sky-600` (atau `accent-primary`).
2. Pemeriksaan visual via Chromium memvalidasi warna aksen kotak centang aktif.
