---
name: liveview-patterns
description: Pola terbaik pengembangan Phoenix LiveView (Socket Lifecycle, Memory Hygiene, Streams, PubSub, JS Commands).
---

# Skill: Phoenix LiveView Patterns

## Hukum Besi & Pola Inti
1. **Otorisasi di Setiap Event (Hukum Besi #2)**: Selalu verifikasi hak akses di setiap `handle_event/3`, jangan hanya di `mount/3`.
2. **Kueri Asinkron di Mount (Hukum Besi #3)**: Gunakan `assign_async/3` atau `if connected?(socket)` agar render HTTP awal tidak terblokir query database.
3. **LiveView Streams untuk List Besar (Hukum Besi #4)**: Gunakan `stream/3` untuk koleksi data panjang agar tidak menduplikasi data di heap memori proses LiveView.
4. **Langganan PubSub Aman (Hukum Besi #5)**: Selalu periksa `if connected?(socket)` sebelum `Phoenix.PubSub.subscribe/2`.
5. **Penanganan Error Form Eksplisit (Hukum Besi #19)**: Tangkap `{:error, %Ecto.Changeset{} = changeset}` secara gamblang pada handler form.
6. **Pemulihan Koneksi (Hukum Besi #25)**: Rancang state form agar mampu pulih saat WebSocket reconnect.
