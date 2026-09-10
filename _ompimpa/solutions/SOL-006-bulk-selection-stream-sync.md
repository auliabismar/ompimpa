---
id: SOL-006
topic: bulk-selection-stream-sync
tags: [liveview, streams, bulk-selection, dom-desync, js-hook]
stack: [elixir, phoenix, liveview, javascript]
date: 2026-09-08
---

# Solusi SOL-006: Sinkronisasi Seleksi Massal pada Phoenix LiveView Streams

## Gejala & Masalah
Saat pengguna mencentang header "Pilih Semua" (*Select All*), state di server terbarui (misal: `@selected_count` menjadi 50), namun kotak centang baris tabel pada DOM peramban tetap kosong / tidak tercentang (*Stream Freeze Bug*). Ketika pengguna mengklik salah satu baris, terjadi desinkronisasi fatal antara server dan tampilan UI lokal.

## Akar Penyebab (Root Cause)
Tabel data menggunakan container `phx-update="stream"`. Phoenix LiveView Stream tidak memodifikasi atau me-render ulang elemen baris yang sudah ada di DOM saat socket assigns server berubah, kecuali elemen tersebut dikirim ulang secara eksplisit melalui `stream_insert/4`. Pengubahan nilai `@selection` murni di server tidak otomatis memutasi atribut `checked` pada elemen input checkbox baris di DOM klien.

## Pola Solusi yang Terbukti (Proven Fix)
Terapkan arsitektur **Client-Server Coordinated Selection**:
1. Server tetap sebagai *Single Source of Truth* untuk daftar ID terpilih.
2. Saat server memproses event `toggle_select_all` atau mutasi seleksi, server memancarkan event `push_event(socket, "bulk-selection-sync", %{selected_ids: ids, mode: :all | :none})`.
3. JS Hook terkolokasi (`BulkSelectionCoordinator`) mendengarkan event tersebut di peramban dan secara langsung menyinkronkan status properti DOM `checkbox.checked = isSelected` pada seluruh baris tabel stream aktif:

```javascript
// hooks/bulk_selection_coordinator.js
export const BulkSelectionCoordinator = {
  mounted() {
    this.handleEvent("bulk-selection-sync", ({ selected_ids, mode }) => {
      const checkboxes = this.el.querySelectorAll('input[type="checkbox"][data-select-id]');
      checkboxes.forEach(cb => {
        const id = cb.getAttribute("data-select-id");
        cb.checked = (mode === "all" || selected_ids.includes(id));
      });
    });
  }
};
```

## Invariant Pencegahan Regresi
1. Seluruh LiveView yang menggunakan container stream dan memiliki seleksi massal wajib memasang hook `BulkSelectionCoordinator` dan memancarkan event `bulk-selection-sync`.
2. Tes ATDD wajib memvalidasi penerimaan event `assert_push_event(view, "bulk-selection-sync", ...)` saat `toggle_select_all` dipicu.
