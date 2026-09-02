---
description: "Mencegah rendering HTML dinamis tanpa sanitasi via raw/1 guna mencegah XSS (Hukum Besi #10)"
globs: ["*.ex", "*.heex"]
scope: "tool:edit(*.ex), tool:edit(*.heex), tool:write(*.ex), tool:write(*.heex)"
condition:
  - '<%=\s*raw\([^)]+\)\s*%>'
  - '\{raw\([^)]+\)\}'
  - '\bPhoenix\.HTML\.raw\([^)]+\)'
interruptMode: always
---

# Pelanggaran Hukum Besi #19: No Unsafe raw/1 HTML

Anda terdeteksi merender `raw/1` dengan konten dinamis tanpa sanitasi.

### Mengapa Dilarang?
`raw/1` bypass HTML escaping → XSS jika konten dari user.

### Solusi Wajib:
Biarkan auto-escape:
```heex
<p>{@user_content}</p>
```
Atau sanitasi:
```elixir
safe = HtmlSanitizeEx.basic_html(untrusted)
```
