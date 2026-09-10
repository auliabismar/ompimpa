# How-To: Merancang Matriks Risiko dan Scaffolding Tes Merah (ATDD)

Panduan ini menjelaskan cara merancang dan membuat berkas pengujian penerimaan yang sengaja berstatus **MERAH (failing)** sebelum implementasi kode backend dimulai.

> 💡 **Integrasi Otomatis**: Tahap scaffolding tes merah ATDD ini secara default **sudah terintegrasi otomatis** di dalam loop `/ompimpa:dev`. Panduan ini digunakan jika Anda ingin merancang, meninjau, atau melakukan scaffolding matriks pengujian secara mandiri (*standalone*) sebelum masuk ke fase koding.

---
## 1. Menjalankan Scaffolder ATDD (`/ompimpa:atdd`)

Panggil perintah ATDD dengan menunjuk ID Story (misal: `A-01` atau `D-02`):

```bash
/ompimpa:atdd A-01
```

### Apa yang Dilakukan Tuanku Imam Bonjol (`ompimpa-test`)?
1. Membaca Acceptance Criteria Gherkin dari spesifikasi mikro JIT (`_ompimpa/specs/SPEC-[ID].md`) atau PRD (`_ompimpa/prd/`).
2. **TEA-01 Traceability & Assertion Guard (Story E-01)**:
   - Memastikan **100% skenario Gherkin (Given-When-Then)** memiliki pemetaan 1:1 ke asersi tes eksplisit.
   - Melarang asersi lemah/tautologis (*Mutation Guard*) seperti `assert true` atau `assert result != nil` yang dapat memicu *false positive*.
3. Mengelompokkan skenario uji ke dalam **Matriks Risiko P1–P4**:
   - **P1 (Kritis/Auth):** Menguji penolakan akses unauthenticated, validasi token, dan presisi numerik `:decimal`.
   - **P2 (Core Loop):** Menguji submit form LiveView dan pembaruan LiveView Streams.
   - **P3 (Edge Cases):** Menguji kegagalan koneksi WebSocket, reconnect, dan deduplikasi data.
   - **P4 (NFR & Performance):** Menguji kepatuhan ambang batas latensi rendering.
4. Menulis berkas tes penerimaan di folder `test/` (misal: `test/my_app_web/live/passkey_live_test.exs`).
---

## 2. Memvalidasi Status Tes Merah

Jalankan pengujian untuk mengonfirmasi bahwa tes gagal secara valid (bukan error sintaks, melainkan fitur memang belum ada):

```bash
mix test test/my_app_web/live/passkey_live_test.exs
```

**Hasil yang Diharapkan:**
```text
1) test Feature 1 Slice 1.1: user registers new passkey credential (MyAppWeb.PasskeyLiveTest)
   ** (UndefinedFunctionError) function MyApp.Accounts.register_passkey/2 is undefined
```

Tes merah ini sekarang menjadi target resmi yang akan diubah menjadi **HIJAU** oleh `/ompimpa:dev`.

---

## 3. Penegakan Kecepatan Tes & Anti-Flaky In-Band (Story E-02)

Suite pengujian OMP-IMPA wajib mematuhi aturan kecepatan dan stabilitas (*rules/elixir-testing-speed.md*):
* **Dilarang `Process.sleep/1`**: Pengujian tidak boleh mengandalkan penundaan tidur arbitrer. Gunakan `assert_receive` dengan timeout wajar atau asersi polling reaktif.
* **Ambang Batas Latensi In-Process < 50ms**: Tes LiveView menggunakan `Phoenix.LiveViewTest` harus menyelesaikan render komponen dalam waktu kurang dari 50 milidetik.
* **Sandbox Database Terisolasi**: Selalu gunakan `Ecto.Adapters.SQL.Sandbox` dengan mode checkout per-proses agar tes dapat berjalan secara asynchronous (`async: true`) tanpa bentrok data.
