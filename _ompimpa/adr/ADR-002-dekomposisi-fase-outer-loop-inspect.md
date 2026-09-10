# ADR-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, 10 Isolated Reviewers Sejati, & Unifikasi Master Diagnostic `/inspect`

> **Status:** Accepted — 2026-09-03  
> **Deciders:** Dewan Balairung Sari (Tan Malaka, H. Agus Salim, Hj. Rasuna Said, Sutan Sjahrir, Tuanku Imam Bonjol, Bung Hatta, Djamaluddin Adinegoro, Marah Rusli) & Ketua Sidang  
> **Rujukan:** `_ompimpa/balairung/BALAIRUNG-20260903-outer-loop-isolated-review-tea-unification.md`  
> **Tags:** `outer-loop`, `isolated-review`, `bmad-tea`, `inspect`, `model-tiering`, `pipeline`, `MADR-3.0`  
> **Supersedes:** —  
> **Amends:** `ADR-001`, `ADR-001-ADDENDUM`, `templates/ompimpa.toml`, `commands/dev.md`, `commands/review.md`, `src/reviewer.ts`, `src/cli.ts`

---

## 1. Context and Problem Statement

Setelah ratifikasi ADR-001 dan ADR-001-Addendum, audit implementasi pada kode sumber OMP-IMPA mengungkap lima anomali dan *spec-reality gap* kritis:

1. **Simulasi Mocking pada Review:** `src/reviewer.ts:dispatchIsolatedReview()` membagi temuan dari satu scanner inline `runPrewalkScan()` ke file JSON disk, sementara 8 reviewer lainnya menulis array kosong `[]`. Hal ini melanggar sumpah anti-inline INV-01 dan meloloskan 100% cacat semantik tingkat tinggi (AC drift, race conditions, auth bypass).
2. **Monolit `/dev` yang Kelebihan Beban:** Perintah `/ompimpa:dev` menggabungkan ATDD, koding, review 10 agen, triage, dan commit dalam satu obrolan chat. Ini memicu *Context Rot* (>100k token), hilangnya kemampuan intervensi per-fase, dan pemborosan biaya model AI karena seluruh fase menggunakan model yang sama.
3. **Over-Engineering MCP Graphify:** Pembuatan MCP Server Graphify terpisah terbukti menambah latensi kompilasi graf (>2.450ms di `test/graphify.test.ts`), padahal file daun (*leaf files*) dan UI tidak memerlukan analisis *blast-radius* global.
4. **Kerapuhan Subprocess TUI Upstream:** Upstream `bmad-loop` membungkus harness dengan TUI PTY Python yang sering mengalami *deadlock* dan *hang*, sehingga OMP-IMPA perlu mendefinisikan batas adopsi yang tangguh tanpa mengorbankan isolasi proses.
5. **Fragmentasi Perintah Diagnostik:** Perintah audit tersebar di `/ompimpa:audit`, `/ompimpa:techdebt`, dan skill phxagents terpisah tanpa mekanisme otomatis untuk mengubah temuan audit menjadi tiket perbaikan backlog.

---

## 2. Decision Drivers

* **D1 — Anti-Bias Mutlak:** Penulis kode dan pengaudit kode tidak boleh berbagi context window atau prompt yang sama.
* **D2 — Zero-Gap Determinism:** Kode hanya boleh di-commit jika memenuhi skor mutlak 100/100 (35-Row Registry) dan 100% kriteria penerimaan Gherkin terverifikasi.
* **D3 — Efisiensi Token & Model Tiering:** Tugas leksikal cepat (`ironlaw`, `verify`) harus dialokasikan ke model hemat (`smol`), tugas penalaran kritis (`security`, `adversarial`) ke model mendalam (`slow`), dan koding ke model seimbang (`default`).
* **D4 — Anti-Context-Rot (Isolasi Memori OTP):** Loop multi-story dalam satu Epic wajib dijalankan dengan context window segar per langkah di level OS shell, bukan menumpuk obrolan di satu sesi interaktif.
* **D5 — Progressive Elaboration:** Spesifikasi tidak boleh dibebankan sekaligus di Master PRD makro; detail teknis harus dimatangkan bertahap sesaat sebelum koding (*Just-In-Time Story Spec*).
* **D6 — Self-Healing Codebase:** Diagnostik menyeluruh harus dapat mentriage temuan secara otomatis menjadi tiket cerita perbaikan (*debt stories*).

---

## 3. Considered Options

### Opsi A — Monolithic In-Harness Extension
Mempertahankan semua proses di dalam sesi chat tunggal `/ompimpa:dev` dan mengandalkan subagent internal untuk seluruh fase.
* **Kontra:** Memicu *context window exhaustion*, developer tidak bisa menjalankan satu fase saja (misal hanya ATDD atau Review), dan biaya token sangat mahal.

### Opsi B — Full Clone `bmad-loop` dengan Python TUI
Meniru persis upstream `agyimpa` dengan mengimpor runtime Python, cangkang TUI (Textual/Blessed), dan pembungkus PTY subprocess.
* **Kontra:** Sangat rapuh, rentan broken pipe/deadlock pada WSL/Linux, menambah dependensi non-native (Python di lingkungan Bun), dan ditolak dewan.

### Opsi C — **Modular Pipeline + TS-Native Outer Driver + Unifikasi `/inspect` (Dipilih)**
1. Memecah `/dev` menjadi 5 perintah atomik: `/story` → `/atdd` → `/code` → `/review` → `/triage`.
2. Menjadikan `bin/ompimpa dev --epic` sebagai Outer Loop Driver di terminal OS shell yang memanggil subprocess OMP bersih per-fase.
3. Menegakkan 10 subagent isolated review sejati melalui batch tool `task(isolated: true)`.
4. Mengadopsi 3 instrumen TEA (TEA-01, Flaky Hunter, Mutation Guard) secara *in-band*.
5. Menyatukan seluruh audit ke dalam perintah master out-of-band: `/ompimpa:inspect`.

---

## 4. Decision Outcome

**Dipilih Opsi C.**

### 1. Pembagian Yurisdiksi Eksekusi
* **Outer CLI Driver (`bin/ompimpa dev --epic <ID> --auto`):** Beroperasi di terminal OS shell. Mengendalikan while-loop antar-story, validasi DAG, git commit, dan update status `feature-status.yaml`. Memanggil OMP headless per-fase untuk menjamin *fresh context*.
* **In-Harness Shortcut (`/ompimpa:dev --story <ID>`):** Beroperasi di dalam sesi chat interaktif OMP. Bertindak sebagai *convenience runner* untuk 1 story tunggal secara berurutan.

### 2. Dekomposisi 5 Perintah Atomik
1. **`/ompimpa:story <ID>`** (`ompimpa-prd`): Menghasilkan dokumen JIT `_ompimpa/specs/SPEC-[Story-ID].md` memuat skenario Gherkin presisi, signature fungsi, dan blast-radius file.
2. **`/atdd <ID>`** (`ompimpa-test` — Tuanku Imam Bonjol): Menulis tes penerimaan merah (*Red-Phase ATDD*) dari Gherkin spec.
3. **`/code <ID>`** (Spesialis Stack: Ash/Ecto/LiveView/Oban): Menulis kode produksi hingga seluruh tes hijau.
4. **`/review <ID>`** (10 Subagent Paralel): Menjalankan audit 10 lensa terisolasi (4 BMAD Spec + 6 phxagents Tech).
5. **`/triage <ID>`** (`src/triage.ts`): Deduplikasi hash `file:line:ruleId`, hitung scorecard 100/100, dan terbitkan Remediation Plan.

### 3. Penegakan 10 Subagent Isolated Review Sejati
* Menghapus mock regex di `src/reviewer.ts:dispatchIsolatedReview()`.
* Review di-dispatch melalui tool `task` paralel ke 10 subagent:
  * 4 BMAD Spec: `bmad_adversarial`, `bmad_gap_verifier`, `bmad_structural`, `bmad_completeness`.
  * 6 phxagents Tech: `ompimpa-ironlaw`, `ompimpa-security`, `ompimpa-test`, `ompimpa-verify`, `ompimpa-ash/ecto`, `ompimpa-liveview/oban`.
* Setiap agen menulis laporannya ke disk: `_ompimpa/review/<storyId>-<reviewerId>.json`.

### 4. Alokasi Model Bertingkat (`[models]` di `ompimpa.toml`)
* **`smol`**: `ironlaw`, `verify`, `commit` (cepat, hemat biaya token hingga 80%).
* **`slow`**: `security`, `adversarial`, `balairung` (penalaran perimeter dan dialektika mendalam).
* **`default`**: `code`, `test`, `structural`, `gap_verifier`, `story`.
* **Deterministic TS (0 token)**: Agregasi dan kalkulasi skor di `src/triage.ts`.

### 5. Pematangan Bertahap Spesifikasi (3-Tingkat BMAD)
* **Tingkat 1 (Analisis):** `_ompimpa/prd/PRD-[ID].md` (Kebutuhan Produk & Scope).
* **Tingkat 2 (Perencanaan):** `_ompimpa/stories.yaml` & `_ompimpa/adr/` (DAG Ketergantungan & Arsitektur).
* **Tingkat 3 (Implementasi JIT):** `_ompimpa/specs/SPEC-[Story-ID].md` (Kontrak mikro sesaat sebelum `/atdd`).

### 6. Yurisdiksi In-Band untuk 3 Instrumen BMAD-TEA
* **TEA-01 Traceability:** Dibuat di `/atdd`, diaudit di `/review` (`bmad_gap_verifier`), divonis di `/triage` (Miss 1 AC = High Finding, BLOCKED).
* **Flaky & Latency Hunter:** Diaudit di `/review` (`ompimpa-test` & `verify`) — melarang `Process.sleep` dan membatasi tes in-process <50ms.
* **Assertion Mutation Guard:** Diaudit di `/review` (`ompimpa-test`) — melarang asersi longgar demi mencegah *false greens*.

### 7. Unifikasi Master Diagnostic Out-of-Band: `/ompimpa:inspect`
* Menyatukan `audit`, `boundaries`, `perf`, dan `techdebt` ke dalam perintah master: **`/ompimpa:inspect`**.
* Berjalan di luar siklus story untuk memindai seluruh codebase.
* Hasil scan di-triage otomatis:
  * Temuan P0/P1 diterbitkan menjadi **`EPIC-DEBT` baru di `_ompimpa/stories.yaml`**.
  * Temuan P2 dicatat ke `_ompimpa/deferred.md` untuk disapu via `ompimpa sweep`.

### 8. Eliminasi MCP Graphify → Lazy Xref
* Rencana pembuatan MCP Server Graphify dibatalkan.
* Dependensi dipetakan secara selektif (*lazy*) menggunakan `mix xref callers` hanya jika file konteks inti (`lib/core/*.ex`) atau skema database diubah.

---

## 5. Enforced Invariants (Hukum Besi Baru)

* **INV-01 Reinforced:** Review WAJIB di-dispatch via subagent paralel terisolasi (`task`). Dilarang memalsukan file review dengan scanner inline.
* **INV-08 Pipeline Modularity:** Setiap fase (`/story`, `/atdd`, `/code`, `/review`, `/triage`) wajib dapat dijalankan secara mandiri tanpa ketergantungan pada obrolan fase sebelumnya.
* **INV-09 JIT Story Specification:** Koding dan ATDD dilarang dimulai tanpa adanya berkas `_ompimpa/specs/SPEC-[Story-ID].md` yang valid.
* **INV-10 In-Band TEA Compliance:** Story dinyatakan PASS hanya jika memenuhi 100% TEA-01 traceability, 0 flaky sleep, dan 0 asersi formalitas.
* **INV-11 Out-of-Band Inspection Isolation:** Perintah `/inspect` dilarang mengubah status story aktif di `feature-status.yaml`; temuan baru wajib masuk melalui jalur backlog `stories.yaml` atau `deferred.md`.

---

## 6. Consequences

### Positif
* Kualitas semantik terjamin 100% anti-bias melalui 10 subagent spesialis sejati.
* Penghematan token masif (60–80%) berkat alokasi model bertingkat (`smol`, `default`, `slow`).
* Tidak ada lagi *context rot* pada pengerjaan multi-story karena loop batch dikendalikan oleh Outer CLI di terminal OS.
* Arsitektur modular: developer memiliki kebebasan penuh menjalankan satu fase saja atau merangkainya dalam pipeline otomatis.
* Codebase bersih dari akumulasi hutang teknis berkat siklus *self-healing* `/inspect` → `EPIC-DEBT`.

### Negatif & Mitigasi
* **Latensi Eksekusi:** Menjalankan 10 subagent dan 5 fase menambah waktu tunggu per story (~45–75 detik).  
  *Mitigasi:* Menggunakan model `smol` untuk reviewer deterministik (`ironlaw`, `verify`) dan membatasi timeout subagent maks 60 detik.
* **Jumlah Berkas Spesifikasi:** Munculnya berkas `_ompimpa/specs/SPEC-*.md` menambah jumlah file di repositori.  
  *Mitigasi:* Seluruh spesifikasi mikro terisolasi rapi di folder `_ompimpa/specs/` dan diabaikan dari kompilasi Elixir.

---

## 7. Rujukan & Hubungan Dokumen

* Risalah Balairung: `_ompimpa/balairung/BALAIRUNG-20260903-outer-loop-isolated-review-tea-unification.md`
* Mengamandemen: `ADR-001`, `ADR-001-ADDENDUM`
* Berkas terdampak: `commands/dev.md`, `commands/review.md`, `commands/story.md` (baru), `commands/code.md` (baru), `commands/triage.md` (baru), `commands/inspect.md` (baru), `src/reviewer.ts`, `src/cli.ts`, `templates/ompimpa.toml`.

---

*Disusun oleh H. Agus Salim (`ompimpa-prd`) & disahkan oleh Dewan Balairung Sari — MADR 3.0+*
