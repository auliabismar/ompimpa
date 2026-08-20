---
description: "Mencegah rendering HTML dinamis tanpa sanitasi via raw/1 guna mencegah XSS (Hukum Besi #10)"
globs: ["*.ex", "*.heex"]
scope: "tool:edit(*.ex), tool:edit(*.heex), tool:write(*.ex), tool:write(*.heex)"
condition:
  - '<%=\s*raw\([^)]+\)\s*%>'
  - '\{raw\([^)]+\)\}'
interruptMode: always
---

# Pelanggaran Hukum Besi #10: Unsafe raw/1 HTML Rendering

Anda terdeteksi merender konten HTML menggunakan fungsi `raw/1` di dalam template HEEx/LiveView.

### Mengapa Dilarang?
Fungsi `raw/1` membypass sistem HTML escaping otomatis milik Phoenix. Jika konten yang dilewatkan ke `raw/1` mengandung masukan dari pengguna tanpa sanitasi ketat, aplikasi Anda terbuka terhadap serangan **Cross-Site Scripting (XSS)**.

### Solusi Wajib:
1. Biarkan Phoenix melakukan auto-escape secara default tanpa pembungkus `raw/1`:
   ```heex
   <p>{@user_content}</p>
   ```
2. Jika memang wajib merender subset HTML terpercaya (misal dari Markdown editor):
   - Gunakan library sanitizer terpercaya (seperti `html_sanitize_ex`) sebelum merender:
   ```elixir
   safe_html = HtmlSanitizeEx.basic_html(@untrusted_content)
   ```
   - Dan pastikan ada komentar teknis eksplisit yang menjelaskan alasan keamanan mengapa bypass diperlukan.
