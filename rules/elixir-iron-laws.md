# 26 Hukum Besi Elixir & Phoenix (The 26 Iron Laws)
*Aturan ini bersifat NON-NEGOTIABLE dan ditegakkan melalui arsitektur pertahanan berlapis: **TTSR Real-Time Stream Guard** (Tier 0) dan **Audit Semantik `ompimpa-ironlaw` (Hj. Rasuna Said)** (Tier 1).*

> **Catatan Arsitektur:** Invariant matematika, tipe data, dan keamanan perimeter di bawah ini bersifat mutlak (*immutable*). Pelanggaran sintaktis langsung di-abort seketika oleh TTSR saat kode sedang diketik di buffer, sementara relasi antar-berkas dan arsitektur tingkat tinggi dinilai oleh Hj. Rasuna Said saat fase review.
1. **Financial & Numeric Precision (Mutlak)** `[Enforced by: TTSR Real-Time]`: DILARANG KERAS menggunakan tipe `:float` untuk uang, harga, diskon, atau saldo. Wajib menggunakan `:decimal` atau integer murni (sen/rupiah terkecil). (*Rule: `rules/elixir-no-float-money.md`*).
2. **LiveView Socket Authorization (Mutlak)** `[Enforced by: Semantic Review]`: Wajib melakukan verifikasi otorisasi di **SETIAP `handle_event/3`**, bukan hanya saat `mount/3`.
3. **No Unconditional DB Queries in Mount** `[Enforced by: Semantic Review]`: Hindari query berat di `mount/3` sinkron — gunakan `assign_async/3` atau cabang `connected?(socket)`.
4. **Streams for Large Lists** `[Enforced by: Semantic Review]`: Wajib menggunakan LiveView Streams (`stream/3`) untuk daftar data melampaui ambang batas `stream_threshold_rows` (default: 100 baris) guna mencegah lonjakan memori proses LiveView.
5. **PubSub Connection Check (Mutlak)** `[Enforced by: TTSR Real-Time]`: Selalu periksa `if connected?(socket)` sebelum melakukan `Phoenix.PubSub.subscribe/2`. (*Rule: `rules/elixir-pubsub-check-connected.md`*).
6. **Ecto Pinning Operator (Mutlak)** `[Enforced by: TTSR Real-Time]`: Selalu sematkan operator `^` pada variabel di query Ecto — dilarang melakukan interpolasi string langsung. (*Rule: `rules/elixir-ecto-pinning.md`*).
7. **Ecto Relationship Loading** `[Enforced by: Semantic Review]`: Selalu gunakan query terpisah untuk `has_many` dan `join` untuk `belongs_to` guna mencegah Cartesian product.
8. **Oban Job Idempotency (Mutlak)** `[Enforced by: TTSR + Semantic Review]`: Seluruh worker Oban wajib *idempotent*, argumen wajib berupa *string keys* (bukan atom), dan dilarang menyimpan struct di argumen job. (*Rule: `rules/elixir-oban-worker-args.md`*).
9. **No String.to_atom on User Input (Mutlak)** `[Enforced by: TTSR Real-Time]`: DILARANG menggunakan `String.to_atom/1` pada data dari pengguna/luar (mencegah *Atom Exhaustion DoS*). Gunakan `String.to_existing_atom/1` atau whitelist map. (*Rule: `rules/elixir-no-string-to-atom.md`*).
10. **No Unsafe raw/1 HTML (Mutlak)** `[Enforced by: TTSR Real-Time]`: DILARANG menggunakan `raw/1` dengan konten dinamis tanpa sanitasi ketat (mencegah XSS). (*Rule: `rules/elixir-no-raw-html.md`*).
11. **No Process Without Runtime Reason** `[Enforced by: Semantic Review]`: DILARANG membuat `GenServer` atau `Agent` hanya untuk merapikan kode. Proses di BEAM hanya untuk konkurensi, state runtime yang bermutasi, atau bottleneck antrean.
12. **Supervise All Long-Lived Processes** `[Enforced by: Semantic Review]`: Setiap proses berumur panjang wajib berada di bawah pohon pengawasan (*Supervision Tree*).
13. **No Implicit Cross Joins (Mutlak)** `[Enforced by: TTSR Real-Time]`: Dilarang menulis `from(a in A, b in B)` tanpa klausa `on:`. (*Rule: `rules/elixir-no-implicit-cross-join.md`*).
14. **Compile-Time External Resources** `[Enforced by: Semantic Review]`: Gunakan `@external_resource` jika modul membaca file eksternal saat kompilasi agar recompilation berjalan otomatis saat file berubah.
15. **Dedup Before cast_assoc** `[Enforced by: Semantic Review]`: Selalu lakukan deduplikasi data sebelum menjalankan `cast_assoc` dengan shared data.
16. **Hidden Inputs for Embedded Fields** `[Enforced by: Semantic Review]`: Selalu sertakan hidden inputs untuk seluruh field embedded yang bersifat wajib pada form.
17. **Wrap Third-Party Library APIs** `[Enforced by: Semantic Review]`: Bungkus library pihak ketiga di balik modul milik proyek (*facade/adapter pattern*) agar mudah diuji dan diganti.
18. **No assign_new for Dynamic Per-Mount Values** `[Enforced by: Semantic Review]`: Dilarang memakai `assign_new/3` untuk data yang harus di-refresh di setiap mount (seperti `current_user` atau `timezone`).
19. **Explicit Changeset Error Matching (Mutlak)** `[Enforced by: TTSR Real-Time]`: Selalu tangkap `{:error, %Ecto.Changeset{}}` secara eksplisit di handler form LiveView — jangan gunakan `{:error, _}` yang menyembunyikan detail kesalahan. (*Rule: `rules/elixir-explicit-changeset-error.md`*).
20. **Mix Task Hygiene** `[Enforced by: TTSR Real-Time]`: Gunakan `Mix.Task.run("app.config") + Application.ensure_all_started/1`, jangan gunakan `Mix.Task.run("app.start")`. (*Rule: `rules/elixir-mix-task-hygiene.md`*).
21. **Process-Local Locale Capture** `[Enforced by: Semantic Review]`: Tangkap Gettext/CLDR locale sebelum memicu `Task` atau `GenServer` baru karena locale bersifat *process-local*.
22. **Comments Are Not Commit Messages** `[Enforced by: Semantic Review]`: Alasan perubahan (tiket, bug, riwayat) ditaruh di commit git, bukan di komentar kode. Komentar kode hanya untuk fakta intrinsik (footguns, invariants, keanehan library).
23. **Ash Resource Policy Fail-Closed (Mutlak)** `[Enforced by: Semantic Review]`: Kebijakan otorisasi Ash wajib menolak akses secara default (*default deny/fail-closed*).
24. **No N+1 in LiveView Renders** `[Enforced by: Semantic Review]`: Selalu preload relasi sebelum data diserahkan ke komponen HEEx.
25. **Graceful LiveView Disconnect Handling** `[Enforced by: Semantic Review]`: Rancang form agar mampu melakukan pemulihan state saat WebSocket terputus dan tersambung kembali.
26. **Verify Before Claiming Done** `[Enforced by: Compiler & Test Gate]`: Wajib menjalankan langkah verifikasi (`quality.verify.steps`) sebelum menyatakan pekerjaan selesai.
