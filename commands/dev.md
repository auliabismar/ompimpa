---
description: Menjalankan loop implementasi slice/story otonom berbasis state di disk dengan siklus Review -> Triage -> Fix -> Re-Review
---

# Command: /ompimpa:dev

Mengeksekusi siklus implementasi kode otonom berbasis state persisten di disk (`_ompimpa/status/feature-status.yaml`) dengan gerbang kualitas tertutup (*Closed-Loop Quality Gate*):

## Penggunaan
```bash
/ompimpa:dev                  # Mengerjakan 1 slice/story berikutnya yang siap dikerjakan
/ompimpa:dev --story 1.2      # Mengerjakan spesifik Story 1.2
/ompimpa:dev --auto           # Menjalankan loop otonom untuk menyelesaikan seluruh story aktif
```

## Alur Siklus Rekayasa Tertutup (Closed-Loop Workflow)

```
[1. BACA STATE DISK]  ──► Membaca `_ompimpa/status/feature-status.yaml`, ambil Story dengan `status: ready-for-dev`.
                                │
[2. ATDD RED-PHASE]   ──► 🛡️ Otomatis memanggil `ompimpa-test` (Tuanku Imam Bonjol) jika berkas tes belum ada:
                          • Membaca Kriteria Penerimaan Gherkin dari PRD.
                          • Men-generate berkas tes penerimaan terfokus (`test/..._test.exs`).
                          • Menjalankan Scoped Test `mix test <path_test.exs>` untuk memastikan status awal tes adalah FAIL (Red Phase).
                                │
[3. DISPATCH SPESIALIS]─► Memanggil subagent sesuai stack (`ompimpa-ash`, `ompimpa-liveview`, dll.)
                          di dalam Git Worktree terisolasi.
                                │
[4. KODING S/D HIJAU] ──► Menulis kode produksi hingga seluruh asersi tes berstatus PASS.
                          (Dilindungi Circuit Breaker: maks 3x retry sebelum eskalasi ke manusia).
                                │
[5. DUAL-REVIEW & TRIAGE]──► 🛡️ Berdasarkan `ompimpa.toml` (`auto_macro_review_in_dev = true`):
                          ⚠️ **INVARIANT ANTI-INLINE**: Review WAJIB di-dispatch melalui subagent terisolasi via tool `task` (DILARANG evaluasi inline di thread utama demi mencegah bias konfirmasi).
                          • A. REVIEW FUNGSIONAL / SPEC (`quality.review.enable_spec_review = true`):
                            Subagent `ompimpa-prd` (H. Agus Salim) / `requirements-verifier`:
                            1. Mengekstrak Acceptance Criteria Gherkin Story terkait dari `_ompimpa/prd/`.
                            2. Memverifikasi diff kode terhadap setiap kriteria penerimaan (AC).
                            3. Memeriksa anti-scope-creep (tidak ada fitur liar di luar PRD).
                            4. Memeriksa deletion-check (tidak ada kontrak fungsional yang terhapus).
                          • B. REVIEW TEKNIS / COMPLIANCE (`quality.review.enable_tech_review = true`):
                            Panel 6-Subagent Spesialis Paralel:
                            1. `ompimpa-ironlaw` (Hj. Rasuna Said): Audit 26 Hukum Besi Semantik
                            2. `ompimpa-security` (Bagindo Azizchan): Audit Keamanan & OWASP
                            3. `ompimpa-test` (Tuanku Imam Bonjol): Scorecard Mutu Pengujian (≥ 90)
                            4. `ompimpa-verify`: Verifikasi Strict Compiler & Warnings-as-Errors
                            5. `ompimpa-ecto` / `ash`: Anti-N+1, Ecto Pinning `^`, Fail-Closed Policies
                            6. `ompimpa-liveview` / `oban`: Memory Assigns Hygiene, Streams, Oban Idempotency
                          • C. OUTPUT MATRIKS KELULUSAN GANDA:
                            Wajib menyajikan tabel kelulusan Spec Review dan Tech Review.
                          • D. TRIAGE & REMEDIASI OTOMATIS (`auto_triage_and_fix = true`):
                            Jika ada temuan P0 (Blocker) atau P1 (Warning):
                            1. Otomatis triage temuan ke subagent spesialis terkait untuk perbaikan.
                            2. Jalankan Re-Review pada diff perbaikan (dibatasi `max_triage_fix_cycles = 2`).
                            3. Jika lolos / 0 Blocker: Lanjut ke commit.
[6. GIT COMMIT & SYNC]──► Jika lolos Re-Review:
                          • Agen Commit (`smol`) membaca staged diff dan men-generate Semantic Commit Message:
                            Format: `<type>(<scope>): <short summary>` (misal: `feat(auth): implement passkey webauthn liveview`)
                            Tipe: `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `chore`.
                          • Eksekusi git commit (dilindungi OMP Guard Hook & Fast Pre-Commit Gate).
                          • Ubah status di `_ompimpa/status/feature-status.yaml` menjadi `status: done`.
[7. REKURSIVITAS]     ──► Jika memakai flag `--auto`: Hook OMP `session_stop` otomatis melanjutkan ke Story berikutnya.
                          Jika tanpa flag: berhenti dan melaporkan hasilnya kepada Anda.
```

## Aturan Kecepatan Pengujian (Scoped vs Global Test)
* **DILARANG** menjalankan `mix test` tanpa argumen di tengah loop koding story.
* **WAJIB** menjalankan scoped test hanya pada file tes slice aktif:
  ```bash
  mix test test/my_app_web/live/passkey_live_test.exs
  ```
* Pengujian global menyeluruh seluruh suite dicadangkan untuk perintah `/ompimpa:verify` saat seluruh fitur selesai.
