# Referensi: 26 Hukum Besi Elixir (The 26 Iron Laws)

Dokumen referensi ini memuat 26 aturan non-negotiable yang wajib dipatuhi oleh seluruh kode yang dihasilkan di dalam ekosistem OMP-IMPA.

> **Catatan Arsitektur:** Invariant matematika, tipe data, dan keamanan perimeter di bawah ini bersifat mutlak (*immutable*). Parameter operasional (seperti ambang batas baris stream LiveView atau target p95 latensi) dapat disesuaikan melalui `ompimpa.toml`.

---

1. **Financial & Numeric Precision (Mutlak)**: DILARANG KERAS menggunakan tipe `:float` untuk uang, harga, diskon, atau saldo. Wajib menggunakan `:decimal` atau integer murni (sen/rupiah terkecil).
2. **LiveView Socket Authorization (Mutlak)**: Wajib melakukan verifikasi otorisasi di **SETIAP `handle_event/3`**, bukan hanya saat `mount/3`.
3. **No Unconditional DB Queries in Mount**: Hindari query berat di `mount/3` sinkron — gunakan `assign_async/3` atau cabang `connected?(socket)`.
4. **Streams for Large Lists**: Wajib menggunakan LiveView Streams (`stream/3`) untuk daftar data melampaui ambang batas `stream_threshold_rows` (default: 100 baris) guna mencegah lonjakan memori proses LiveView.
5. **PubSub Connection Check (Mutlak)**: Selalu periksa `if connected?(socket)` sebelum melakukan `Phoenix.PubSub.subscribe/2`.
6. **Ecto Pinning Operator (Mutlak)**: Selalu sematkan operator `^` pada variabel di query Ecto — dilarang melakukan interpolasi string langsung.
7. **Ecto Relationship Loading**: Selalu gunakan query terpisah untuk `has_many` dan `join` untuk `belongs_to` guna mencegah Cartesian product.
8. **Oban Job Idempotency (Mutlak)**: Seluruh worker Oban wajib *idempotent*, argumen wajib berupa *string keys* (bukan atom), dan dilarang menyimpan struct di argumen job.
9. **No String.to_atom on User Input (Mutlak)**: DILARANG menggunakan `String.to_atom/1` pada data dari pengguna/luar (mencegah *Atom Exhaustion DoS*). Gunakan `String.to_existing_atom/1` atau whitelist map.
10. **No Unsafe raw/1 HTML (Mutlak)**: DILARANG menggunakan `raw/1` dengan konten dinamis tanpa sanitasi ketat (mencegah XSS).
11. **No Process Without Runtime Reason**: DILARANG membuat `GenServer` atau `Agent` hanya untuk merapikan kode. Proses di BEAM hanya untuk konkurensi, state runtime yang bermutasi, atau bottleneck antrean.
12. **Supervise All Long-Lived Processes**: Setiap proses berumur panjang wajib berada di bawah pohon pengawasan (*Supervision Tree*).
13. **No Implicit Cross Joins (Mutlak)**: Dilarang menulis `from(a in A, b in B)` tanpa klausa `on:`.
14. **Compile-Time External Resources**: Gunakan `@external_resource` jika modul membaca file eksternal saat kompilasi agar recompilation berjalan otomatis saat file berubah.
15. **Dedup Before cast_assoc**: Selalu lakukan deduplikasi data sebelum menjalankan `cast_assoc` dengan shared data.
16. **Hidden Inputs for Embedded Fields**: Selalu sertakan hidden inputs untuk seluruh field embedded yang bersifat wajib pada form.
17. **Wrap Third-Party Library APIs**: Bungkus library pihak ketiga di balik modul milik proyek (*facade/adapter pattern*) agar mudah diuji dan diganti.
18. **No assign_new for Dynamic Per-Mount Values**: Dilarang memakai `assign_new/3` untuk data yang harus di-refresh di setiap mount (seperti `current_user` atau `timezone`).
19. **Explicit Changeset Error Matching (Mutlak)**: Selalu tangkap `{:error, %Ecto.Changeset{}}` secara eksplisit di handler form LiveView — jangan gunakan `{:error, _}` yang menyembunyikan detail kesalahan.
20. **Mix Task Hygiene**: Gunakan `Mix.Task.run("app.config") + Application.ensure_all_started/1`, jangan gunakan `Mix.Task.run("app.start")`.
21. **Process-Local Locale Capture**: Tangkap Gettext/CLDR locale sebelum memicu `Task` atau `GenServer` baru karena locale bersifat *process-local*.
22. **Comments Are Not Commit Messages**: Alasan perubahan (tiket, bug, riwayat) ditaruh di commit git, bukan di komentar kode. Komentar kode hanya untuk fakta intrinsik (footguns, invariants, keanehan library).
23. **Ash Resource Policy Fail-Closed (Mutlak)**: Kebijakan otorisasi Ash wajib menolak akses secara default (*default deny/fail-closed*).
24. **No N+1 in LiveView Renders**: Selalu preload relasi sebelum data diserahkan ke komponen HEEx.
25. **Graceful LiveView Disconnect Handling**: Rancang form agar mampu melakukan pemulihan state saat WebSocket terputus dan tersambung kembali.
26. **Verify Before Claiming Done**: Wajib menjalankan langkah verifikasi (`quality.verify.steps`) sebelum menyatakan pekerjaan selesai.
