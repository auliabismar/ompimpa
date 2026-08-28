---
description: Menjalankan pemindaian AST & Regex pra-kompilasi terhadap 26 Hukum Besi Elixir dan aturan TTSR
---

# Command: /prewalk

Mengeksekusi pemindaian AST (*Abstract Syntax Tree*) dan traversal statis pada seluruh berkas Elixir (`lib/` dan `test/`) sebelum kode dikompilasi atau diuji.

## Penggunaan

```bash
/prewalk                      # Memindai seluruh berkas di lib/ dan test/
/prewalk lib/my_app/auth.ex   # Memindai berkas spesifik
/prewalk lib/my_app_web/live  # Memindai direktori LiveView
```

## Pola yang Dideteksi & Dicegah

1. **Keuangan**: `:float` pada field harga/saldo/diskon (`elixir-no-float-money.md`).
2. **OTP / Concurrency**: `Task.start` / `Task.async` tanpa supervisor (`elixir-no-unsupervised-task.md`).
3. **LiveView Hygiene**:
   * `Repo.all` atau `Ash.read` tanpa batasan di dalam `mount/3` (`elixir-liveview-unbounded-query.md`).
   * Direct assign list besar tanpa `temporary_assigns` atau Streams (`elixir-liveview-temporary-assigns.md`).
4. **Security & Atom**:
   * `String.to_atom/1` dinamis yang rentan *Atom Exhaustion* (`elixir-no-string-to-atom.md`).
   * `Phoenix.HTML.raw/1` atau `raw/1` XSS (`elixir-no-raw-html.md`).
   * Bypass otorisasi Ash `authorize?: false` (`elixir-ash-no-unauthorized-bypass.md`).
5. **Database / Ecto**:
   * Cross join implisit tanpa relasi eksplisit (`elixir-no-implicit-cross-join.md`).
   * Ecto query tanpa operator pinning `^`.
6. **Oban**:
   * Worker arguments dengan atom keys bukan string keys (`elixir-oban-worker-args.md`).

## Luaran (*Output*)

* **0 Pelanggaran**: `✅ [PREWALK PASSED]` — kode bersih dan aman untuk dikompilasi/direview.
* **Ada Pelanggaran**: `❌ [PREWALK FAILED]` — daftar temuan beserta lokasi baris:kolom dan instruksi perbaikan konkret.
