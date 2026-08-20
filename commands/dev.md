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
[2. CEK TES MERAH]    ──► ⚡ Menjalankan Scoped Test: `mix test <path_test.exs>` (Bukan `mix test` global).
                          Memastikan status awal tes ATDD adalah FAIL (Red Phase).
                                │
[3. DISPATCH SPESIALIS]─► Memanggil subagent sesuai stack (`ompimpa-ash`, `ompimpa-liveview`, dll.)
                          di dalam Git Worktree terisolasi.
                                │
[4. KODING S/D HIJAU] ──► Menulis kode produksi hingga seluruh asersi tes berstatus PASS.
                          (Dilindungi Circuit Breaker: maks 3x retry sebelum eskalasi ke manusia).
                                │
[5. REVIEW & TRIAGE]  ──► 🛡️ Menjalankan Macro-Review 4-Jalur (Hukum Besi + Keamanan + QA + Compiler):
                          • Jika ada temuan P0/Blocker atau P1/Warning:
                            1. Triage & filter temuan ke dalam tugas perbaikan terfokus.
                            2. Panggil spesialis untuk koding remediasi.
                            3. Jalankan RE-REVIEW pada diff perbaikan.
                          • Jika lolos / 0 Blocker: Lanjut ke commit.
                                │
[6. GIT COMMIT & SYNC]──► Jika lolos Re-Review:
                          • Buat git commit (dilindungi OMP Guard Hook & Fast Pre-Commit Gate).
                          • Ubah status di `_ompimpa/status/feature-status.yaml` menjadi `status: done`.
                                │
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
