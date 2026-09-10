# Referensi: 26 Hukum Besi Elixir (The 26 Iron Laws)

Dokumen referensi ini memuat 26 aturan non-negotiable yang wajib dipatuhi oleh seluruh kode yang dihasilkan di dalam ekosistem OMP-IMPA.

> **Catatan Arsitektur & Penegakan Berlapis:**
> Invariant matematika, tipe data, dan keamanan perimeter di bawah ini bersifat mutlak (*immutable*). 
> - **Tier 0 (TTSR Real-Time Stream Guard):** 26 aturan di bawah ini didefinisikan 1:1 dalam berkas modular `rules/01-*.md` s/d `rules/26-*.md`. Aturan berpola sintaktis/primitif langsung diinterupsi (*abort & roll-back*) saat kode sedang diketik di buffer streaming toolcalls (`edit`/`write`).
> - **Tier 1 (Audit Semantik Hj. Rasuna Said):** Aturan arsitektur tingkat tinggi dan relasi multi-berkas dinilai oleh subagent `ompimpa-ironlaw` pada fase review terisolasi.
---

1. **Financial & Numeric Precision (Mutlak)** `[Enforced by: TTSR Real-Time]` *(Rule: `rules/01-no-float-money.md`)*: DILARANG KERAS menggunakan tipe `:float` untuk uang, harga, diskon, atau saldo. Wajib menggunakan `:decimal` atau integer murni (sen/rupiah terkecil).
2. **LiveView Socket Authorization (Mutlak)** `[Enforced by: TTSR + Semantic Review]` *(Rule: `rules/02-no-disconnected-mount-queries.md`)*: Wajib melakukan verifikasi otorisasi di **SETIAP `handle_event/3`**, bukan hanya saat `mount/3`. Hindari query data privat sebelum koneksi socket terverifikasi.
3. **Streams for Large Lists (Mutlak)** `[Enforced by: TTSR + Semantic Review]` *(Rule: `rules/03-mandatory-streams.md`)*: Wajib menggunakan LiveView Streams (`stream/3`) untuk daftar data hasil query > 100 baris guna mencegah lonjakan memori proses LiveView.
4. **No Raw SQL Interpolation (Mutlak)** `[Enforced by: TTSR Real-Time]` *(Rule: `rules/04-no-raw-sql-interpolation.md`)*: DILARANG melakukan interpolasi string langsung ke dalam fragment SQL. Gunakan parameter binding `^` Ecto.
5. **PubSub Connection Check (Mutlak)** `[Enforced by: TTSR Real-Time]` *(Rule: `rules/05-pubsub-check-connected.md`)*: Selalu periksa `if connected?(socket)` sebelum melakukan `Phoenix.PubSub.subscribe/2`.
6. **Explicit Changeset Error Handling** `[Enforced by: TTSR + Semantic Review]` *(Rule: `rules/06-explicit-changeset-error-handling.md`)*: Tangkap dan tangani `{:error, %Ecto.Changeset{}}` secara eksplisit, jangan telan error dengan wildcard `_`.
7. **No assign_new for Dynamic Per-Mount Values** `[Enforced by: TTSR + Semantic Review]` *(Rule: `rules/07-no-assign-new-for-dynamic-data.md`)*: Dilarang memakai `assign_new/3` untuk data yang harus di-refresh di setiap mount (seperti `current_user` atau status dinamis).
8. **Check Changeset Errors Before Form Debug** `[Enforced by: Semantic Review]` *(Rule: `rules/08-check-changeset-errors-before-form-debug.md`)*: Selalu periksa `changeset.action` dan errors saat debugging form yang gagal submit.
9. **Separate has_many, Use Join for belongs_to** `[Enforced by: Semantic Review]` *(Rule: `rules/09-separate-has-many-use-join-belongs-to.md`)*: Gunakan query terpisah untuk relasi `has_many` dan join untuk `belongs_to` guna mencegah Cartesian product.
10. **No Implicit Cross Joins (Mutlak)** `[Enforced by: TTSR Real-Time]` *(Rule: `rules/10-no-implicit-cross-join.md`)*: Dilarang menulis `from(a in A, b in B)` tanpa klausa `on:`.
11. **Dedup Shared Data Before cast_assoc** `[Enforced by: Semantic Review]` *(Rule: `rules/11-dedup-shared-data-before-cast-assoc.md`)*: Selalu lakukan deduplikasi data bersama sebelum menjalankan `cast_assoc`.
12. **Hidden Inputs for Embedded Schemas** `[Enforced by: TTSR + Semantic Review]` *(Rule: `rules/12-hidden-inputs-for-embedded-schemas.md`)*: Selalu sertakan hidden inputs untuk seluruh field ID embedded yang wajib pada form LiveView.
13. **Oban Job Idempotency & Unique (Mutlak)** `[Enforced by: TTSR + Semantic Review]` *(Rule: `rules/13-oban-jobs-idempotent-unique.md`)*: Seluruh worker Oban wajib *idempotent* dan mendefinisikan konfigurasi `unique:` saat menangani mutasi finansial/state kritis.
14. **Oban String Keys in Args (Mutlak)** `[Enforced by: TTSR Real-Time]` *(Rule: `rules/14-oban-string-keys-args.md`)*: Argumen job Oban wajib diakses via *string keys* (`args["user_id"]`), bukan atom keys.
15. **No Structs in Oban Args (Mutlak)** `[Enforced by: TTSR Real-Time]` *(Rule: `rules/15-no-structs-in-oban-args.md`)*: DILARANG mengoper struct Elixir ke dalam argumen Oban — serialisasikan menjadi ID primitif atau map sederhana.
16. **Oban SmartEngine Snooze Guard** `[Enforced by: Semantic Review]` *(Rule: `rules/16-oban-smart-engine-snooze-guard.md`)*: Pastikan penanganan snooze dan retry worker tidak memicu starvation pada queue.
17. **No String.to_atom on User Input (Mutlak)** `[Enforced by: TTSR Real-Time]` *(Rule: `rules/17-no-string-to-atom-user-input.md`)*: DILARANG menggunakan `String.to_atom/1` pada data dari pengguna/luar (mencegah *Atom Exhaustion DoS*). Gunakan `String.to_existing_atom/1` atau whitelist map.
18. **Mandatory Auth in handle_event (Mutlak)** `[Enforced by: TTSR + Semantic Review]` *(Rule: `rules/18-mandatory-auth-handle-event.md`)*: Wajib validasi otorisasi di setiap handler event mutasi, jangan percaya input parameter klien.
19. **No Raw Dynamic HTML Content (Mutlak)** `[Enforced by: TTSR Real-Time]` *(Rule: `rules/19-no-raw-dynamic-content.md`)*: DILARANG menggunakan `Phoenix.HTML.raw/1` dengan konten dinamis tanpa sanitasi ketat (mencegah XSS).
20. **OTP Process Spawning Justification** `[Enforced by: TTSR + Semantic Review]` *(Rule: `rules/20-otp-process-spawning-justification.md`)*: DILARANG membuat `GenServer` atau `Agent` hanya untuk merapikan kode. Proses di BEAM hanya untuk konkurensi, state runtime yang bermutasi, atau bottleneck antrean.
21. **Supervised Long-Lived Processes** `[Enforced by: TTSR + Semantic Review]` *(Rule: `rules/21-supervised-long-lived-processes.md`)*: Setiap proses berumur panjang dan asynchronous wajib berada di bawah pohon pengawasan (*Supervision Tree*) atau Oban.
22. **External Resource Compile-Time Declaration** `[Enforced by: Semantic Review]` *(Rule: `rules/22-external-resource-compile-time.md`)*: Gunakan `@external_resource` jika modul membaca file eksternal saat kompilasi agar recompilation berjalan otomatis saat file berubah.
23. **Facade Pattern for Third-Party APIs** `[Enforced by: Semantic Review]` *(Rule: `rules/23-facade-third-party-apis.md`)*: Bungkus library pihak ketiga di balik modul milik proyek (*facade/adapter pattern*) agar mudah diuji dan diganti.
24: **Mix Task Minimal App Start** `[Enforced by: TTSR Real-Time]` *(Rule: `rules/24-mix-tasks-minimal-app-start.md`)*: Gunakan `Mix.Task.run("app.config") + Application.ensure_all_started/1`, jangan gunakan `Mix.Task.run("app.start")`.
25. **Capture Locale Before Spawning Task** `[Enforced by: Semantic Review]` *(Rule: `rules/25-capture-locale-before-spawning.md`)*: Tangkap Gettext/CLDR locale sebelum memicu `Task` atau `GenServer` baru karena locale bersifat *process-local*.
26. **Pure Code Comments & Mandatory Verification (Mutlak)** `[Enforced by: TTSR + Compiler Gate]` *(Rule: `rules/26-pure-code-comments-and-verification.md`)*: Alasan perubahan ditaruh di commit git, bukan di komentar kode. Dan WAJIB menjalankan langkah verifikasi (`quality.verify.steps`) sebelum menyatakan pekerjaan selesai.

---

## Aturan Kecepatan Tes & Kualitas In-Band (Story E-02)

Selain 26 Hukum Besi di atas, berlaku aturan kecepatan eksekusi pengujian (*In-Band Test Speed Guard* per `rules/elixir-testing-speed.md`):
* **Dilarang `Process.sleep/1`**: Gunakan asersi polling reaktif (`assert_receive`, `eventually`, atau sinkronisasi proses).
* **Ambang Batas In-Process LiveViewTest**: Setiap pengujian LiveView berbasis `Phoenix.LiveViewTest` wajib menyelesaikan siklus render dalam waktu **< 50ms**.
* **Asersi Non-Kosong**: Dilarang asersi tautologis (`assert true`, `assert !nil`) yang dapat meloloskan tes palsu (*Assertion Mutation Guard* per Story E-01).
