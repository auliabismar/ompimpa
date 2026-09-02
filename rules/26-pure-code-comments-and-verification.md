---
description: "Mewajibkan komentar kode murni dan verifikasi sebelum klaim selesai (Hukum Besi #22 & #26)"
globs: ["*.ex", "*.exs", "*.heex"]
scope: "tool:edit(*.ex), tool:edit(*.exs), tool:edit(*.heex), tool:write(*.ex), tool:write(*.exs)"
condition:
  - '#\s*TODO.*fix.*later'
interruptMode: always
---

# Pelanggaran Hukum Besi #26: Pure Code Comments and Verification

Anda terdeteksi menulis komentar yang berisi alasan perubahan (tiket/bug) atau TODO liar, atau klaim selesai tanpa verifikasi.

### Mengapa Dilarang?
Alasan perubahan milik commit message, bukan komentar; TODO tanpa tiket membusuk. Klaim selesai tanpa `mix compile --warnings-as-errors` + test menyembunyikan regresi.

### Solusi Wajib:
- Komentar hanya untuk fakta intrinsik: footguns, invariants, keanehan library.
- Jalankan `quality.verify.steps` sebelum menyatakan done.
- Gunakan `# INVARIANT:` atau `# FOOTGUN:` untuk dokumentasi teknis.
