---
description: "Mewajibkan hidden inputs untuk field embedded wajib pada form (Hukum Besi #16)"
globs: ["*.ex", "*.heex"]
scope: "tool:edit(*.ex), tool:edit(*.heex), tool:write(*.ex), tool:write(*.heex)"
condition:
  - 'embeds_one.*embeds_many'
interruptMode: always
---

# Pelanggaran Hukum Besi #12: Hidden Inputs for Embedded Fields

Anda terdeteksi menggunakan embedded schema tanpa hidden inputs untuk field wajib.

### Mengapa Dilarang?
Tanpa hidden inputs, data embedded yang tidak dirender hilang saat submit, memicu validasi gagal diam-diam.

### Solusi Wajib:
Sertakan hidden inputs untuk seluruh field embedded wajib:
```heex
<.input field={f[:embedded_id]} type="hidden" />
```
