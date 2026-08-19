# How-To: Merancang Matriks Risiko dan Scaffolding Tes Merah (ATDD)

Panduan ini menjelaskan cara membuat berkas pengujian penerimaan yang sengaja berstatus **MERAH (failing)** sebelum implementasi kode backend dimulai.

---

## 1. Menjalankan Scaffolder ATDD (`/ompimpa:atdd`)

Panggil perintah ATDD dengan menunjuk nomor Slice atau Feature dari PRD:

```bash
/ompimpa:atdd "Feature 1 Slice 1.1"
```

### Apa yang Dilakukan Tuanku Imam Bonjol (`ompimpa-test`)?
1. Membaca Acceptance Criteria Gherkin dari `docs/prd/`.
2. Mengelompokkan skenario uji ke dalam **Matriks Risiko P1–P4**:
   - **P1 (Kritis/Auth):** Menguji penolakan akses unauthenticated, validasi token, dan presisi numerik `:decimal`.
   - **P2 (Core Loop):** Menguji submit form LiveView dan pembaruan LiveView Streams.
   - **P3 (Edge Cases):** Menguji kegagalan koneksi WebSocket dan duplikasi data.
3. Menulis file tes di `test/my_app_web/live/passkey_live_test.exs`.

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
