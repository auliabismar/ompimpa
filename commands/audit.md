---
description: Menjalankan audit kesehatan arsitektur Phoenix menyeluruh (Xref coupling, N+1 queries, Assigns bloat, Hex security)
---

# Command: /ompimpa:audit

Memindai seluruh codebase terhadap anomali performa, coupling modul, dan risiko rantai pasokan:

## Penggunaan
```bash
/ompimpa:audit                # Audit kesehatan sistem lengkap
/ompimpa:audit --n1           # Khusus mendeteksi anti-pattern kueri N+1
/ompimpa:audit --assigns      # Khusus mendeteksi assign bloat pada LiveView
/ompimpa:audit --deps         # Khusus audit dependensi Hex dan lisensi
```

## Komponen yang Diperiksa
1. **Context Coupling**: Menganalisis graph panggilan modul via `mix xref graph` untuk menemukan dependensi melingkar (*circular dependencies*).
2. **Kueri N+1**: Memindai pemanggilan Repo di dalam loop `Enum` atau render template HEEx.
3. **Memori LiveView**: Memeriksa assign soket yang terlalu besar tanpa `temporary_assigns` atau LiveView Streams.
4. **Keamanan Dependensi Hex**: Memindai `mix.lock` terhadap advisory keamanan dan file bidi berbahaya.
