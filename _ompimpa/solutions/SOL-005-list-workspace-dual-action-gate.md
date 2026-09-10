---
id: SOL-005
topic: list-workspace-dual-action-gate
tags: [ui, corecomponents, heex, buttons, conflict]
stack: [frontend, heex, phoenix]
date: 2026-09-08
---

# Solusi SOL-005: Gerbang Tunggal Tombol Aksi List Workspace

## Gejala & Masalah
Pada header halaman daftar (`list_workspace`), muncul dua tombol "Tambah" / "+ Tambah Data" yang keduanya aktif secara bersamaan, atau salah satu aktif dan yang lain tidak berfungsi.

## Akar Penyebab (Root Cause)
Komponen layout header me-render dua hal tanpa logika *mutually exclusive*:
1. Atribut navigasi default `new_navigate={~p"/..."}` yang selalu me-render tombol tambah statis bawaan layout.
2. Slot kustom `<:actions>` yang disediakan oleh LiveView pemanggil (yang sering kali menyuntikkan tombol tambah dengan otorisasi atau aksi spesifik).

## Pola Solusi yang Terbukti (Proven Fix)
Tegakkan prinsip **Gerbang Tunggal (Single-Gate Action)** pada komponen layout:
Jika slot `<:actions>` disediakan oleh pemanggil, jangan render tombol `new_navigate` bawaan, ATAU kosongkan `new_navigate` pada pemanggil jika menggunakan slot `<:actions>`.

```heex
<%!-- DI DEFINISI KOMPONEN LIST WORKSPACE --%>
<div class="flex items-center gap-2">
  <%= if @actions != [] do %>
    <%= render_slot(@actions) %>
  <% else %>
    <%= if @new_navigate do %>
      <.button link={@new_navigate} variant="primary">
        + <%= @new_label || "Tambah Baru" %>
      </.button>
    <% end %>
  <% end %>
</div>
```

## Invariant Pencegahan Regresi
1. Header halaman daftar tidak boleh me-render lebih dari 1 tombol primer untuk aksi yang sama.
2. Asersi pengujian UI memastikan tepat 1 tombol tambah yang muncul di halaman (`assert count == 1`).
