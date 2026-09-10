---
description: Menjalankan implementasi kode produksi (Green-Phase) oleh spesialis stack hingga seluruh asersi tes merah lolos bersama Mr. Assaat, Bung Hatta, Tuanku Tambusai, Djamaluddin Tamin, dan Sutan Sjahrir
---

# Command: /ompimpa:code

Mengeksekusi fase implementasi kode produksi (*Green-Phase Implementation*) untuk mengubah asersi tes merah (*Red-Phase ATDD*) dari `/atdd` menjadi hijau (*passing*), dipandu oleh kontrak mikro *just-in-time* (`_ompimpa/specs/SPEC-[STORY_ID].md`) dan dilindungi oleh batas penghentian *Circuit Breaker*.

> 🛡️ **Invarian INV-08 (Pipeline Modularity):**  
> Perintah `/code` dapat dijalankan secara mandiri oleh pengembang untuk story tertentu tanpa harus dipaksa menjalankan seluruh siklus `/dev`.
>
> 🛡️ **Invarian INV-09 (JIT Story Specification):**  
> Implementasi koding dilarang dimulai tanpa adanya berkas spesifikasi mikro `_ompimpa/specs/SPEC-[STORY_ID].md` yang valid, deterministik, dan terverifikasi.

---

## Dewan Tokoh & Spesialis Stack (Execution Panel)

Fase koding dikerjakan oleh subagent spesialis stack OMP-IMPA yang terisolasi sesuai ranah arsitektur:

1. **`ompimpa-ash` (Inspirasi Mr. Assaat — Presiden RIS):**  
   Merancang Resource deklaratif Ash Framework 3.0+, Actions (`create`, `read`, `update`, `destroy`), kebijakan otorisasi *fail-closed* (*default deny*), agregasi, kalkulasi, dan optimasi query multi-tenant.
2. **`ompimpa-ecto` (Inspirasi Bung Hatta — Proklamator & Tertib Administrasi):**  
   Merancang skema Ecto tertib, validasi changeset ketat, konstrain integritas data, operator pinning `^` pada seluruh kueri dinamis, migrasi aman (*reversible*), dan transaksi multi-langkah `Ecto.Multi`.
3. **`ompimpa-liveview` (Inspirasi Tuanku Tambusai — Harimau Rokan):**  
   Menguasai siklus hidup soket Phoenix LiveView, higienitas memori (*assigns hygiene* rendah memori), LiveView Streams (`stream/3` untuk data > 100 baris), JS Hooks, optimasi latensi, PubSub, dan pemulihan koneksi.
4. **`ompimpa-oban` (Inspirasi Djamaluddin Tamin — Perintis Gerakan Tangguh):**  
   Merancang *worker background* Oban yang tangguh dan 100% idempoten, penegakan argumen *string keys* (melarang atom keys), antrean unik (*unique jobs*), alur terjadwal cron, dan mitigasi *backoff/retry*.
5. **`ompimpa-otp` (Inspirasi Sutan Sjahrir — Arsitek Diplomasi & Tata Kelola):**  
   Menata arsitektur *Supervision Tree*, strategi supervisi (`:one_for_all`, `:rest_for_one`), isolasi kegagalan proses (*let it crash* terkontrol), dan menolak penggunaan GenServer liar jika fungsi modul murni sudah mencukupi.
6. **`ompimpa-ui` (Inspirasi Marah Rusli — Sastrawan & Perancang Visual):**  
   Merancang komponen HEEx modular, tata letak Tailwind CSS responsif, CoreComponents, dan struktur antarmuka yang ramah aksesibilitas (*ARIA compliant*).

---

## Penggunaan

### Di Dalam Sesi OMP Harness
```bash
/ompimpa:code <STORY_ID>           # Contoh: /ompimpa:code D-02
/code <STORY_ID>                   # Alias singkat
```

### Di Terminal OS Shell (Outer CLI)
```bash
ompimpa code <STORY_ID>            # Menjalankan verifikasi kontrak spec dan panduan koding
ompimpa code <STORY_ID> --strict   # Gagal cepat jika ada prasyarat yang belum terpenuhi
```

---

## Alur Kerja Implementasi (Workflow)

```
[1. VALIDASI INV-09]    ──► Periksa keberadaan `_ompimpa/specs/SPEC-[STORY_ID].md`.
                             Jika berkas belum ada, batalkan eksekusi dan arahkan ke `/ompimpa:story`.
                                  │
[2. BACA KONTRAK MIKRO] ──► Ekstrak dari SPEC-[ID].md:
                             • Skenario Gherkin (`@ac-*`, `@tea-01`).
                             • Tanda tangan fungsi (*exact function signatures & typespecs*).
                             • Skema data / migrasi Ecto / Ash resource.
                             • Berkas target implementasi dan berkas uji ATDD.
                                  │
[3. DISPATCH SPESIALIS] ──► Tentukan spesialis stack yang tepat (`ash`, `ecto`, `liveview`, `oban`, `otp`).
                             Kerjakan implementasi di berkas target produksi.
                                  │
[4. SCOPED TEST LOOP]   ──► Jalankan pengujian terfokus (SCOPED TEST ONLY):
                             • Elixir: `mix test test/path/to/specific_test.exs`
                             • TypeScript/Bun: `bun test test/path/to/specific.test.ts`
                             ⚠️ DILARANG menjalankan test suite global di tengah loop koding!
                                  │
[5. CIRCUIT BREAKER]    ──► Evaluasi status asersi:
                             • Jika HIJAU (Passing) ──► Selesai! Teruskan ke `/review <STORY_ID>`.
                             • Jika MERAH (Failing):
                               - Siklus < 3: Analisis error trace, lakukan perbaikan, ulangi langkah 4.
                               - Siklus = 3: TRIGGER CIRCUIT BREAKER! Hentikan loop dan eskalasikan
                                 laporan kebuntuan (*deadlock report*) kepada developer.
```

---

## Batasan & Invarian Rekayasa (Guardrails)

### 1. Circuit Breaker (Maksimal 3 Siklus Retry)
Untuk mencegah perputaran tanpa akhir (*infinite prompt loop*) dan pemborosan kuota model AI, fase `/code` dibatasi maksimal **3 siklus perbaikan berturut-turut**:
- **Siklus 1:** Implementasi awal berdasarkan tanda tangan fungsi di `SPEC-[ID].md`.
- **Siklus 2:** Perbaikan pertama bila ada asersi merah atau kesalahan kompilasi.
- **Siklus 3:** Penyesuaian akhir logika perbatasan (*boundary conditions*).
- **Eskalasi:** Jika pada akhir siklus 3 tes masih berstatus merah, eksekusi WAJIB berhenti dan memaparkan:
  - Asersi mana yang gagal beserta pesan galatnya (*failure message & stacktrace*).
  - Hipotesis penyebab kebuntuan (*root-cause hypothesis*).
  - Opsi tindakan untuk pengembang manusia (*human intervention checklist*).

### 2. Aturan Kecepatan Pengujian (Scoped Test Only)
- **DILARANG** menjalankan `mix test` atau `bun test` tanpa argumen di tengah loop koding story.
- **WAJIB** menjalankan *scoped test* hanya pada berkas tes yang terdaftar di `SPEC-[ID].md`:
  ```bash
  mix test test/my_app_web/live/user_live_test.exs:42
  ```

### 3. Penegakan 26 Hukum Besi Elixir
- **Hukum Besi #1:** Dilarang tipe `:float` untuk representasi uang/saldo (Wajib `:decimal` atau integer sen).
- **Hukum Besi #2:** Wajib otorisasi soket di setiap `handle_event/3`.
- **Hukum Besi #3:** Wajib LiveView Streams (`stream/3`) untuk daftar data > 100 baris.
- **Hukum Besi #4:** Wajib operator pinning `^` pada kueri Ecto dinamis.
- **Hukum Besi #5:** Seluruh worker Oban wajib idempoten dengan *string keys*.
- **Hukum Besi #7:** Kebijakan otorisasi Ash wajib *fail-closed* (*default deny*).

---

## Integrasi Rantai Perintah (Outer Loop Pipeline)

Sesuai arsitektur **ADR-002**, posisi `/code` dalam 5 fase rekayasa modular:
1. `/ompimpa:story <ID>` ➔ Kontrak mikro JIT `SPEC-[ID].md`.
2. `/atdd <ID>` ➔ Scaffolding tes merah ExUnit/LiveViewTest failing.
3. **`/code <ID>`** ➔ **Implementasi kode produksi hingga seluruh tes hijau (Fase Aktif).**
4. `/review <ID>` ➔ Dispatch 10 subagent isolated review independen.
5. `/triage <ID>` ➔ Deduplikasi hash dan vonis scorecard 100/100 PASS/REMEDIATE.
