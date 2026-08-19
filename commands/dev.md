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
[2. CEK TES MERAH]    ──► Menjalankan `mix test <path_test.exs>` untuk memastikan status awal adalah FAIL.
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
                          • Buat git commit: `feat(slice-1.1): implement <nama_story>`
                          • Ubah status di `_ompimpa/status/feature-status.yaml` menjadi `status: done`.
                                │
[7. REKURSIVITAS]     ──► Jika memakai flag `--auto`: otomatis lanjut ke Story berikutnya.
                          Jika tanpa flag: berhenti dan melaporkan hasilnya kepada Anda.
```
