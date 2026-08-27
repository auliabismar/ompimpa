---
description: "Mencegah pembuatan proses asynchronous tanpa supervisi via Task.start/start_link/async (Hukum Besi #12)"
globs: ["*.ex", "*.exs"]
scope: "tool:edit(*.ex), tool:edit(*.exs), tool:write(*.ex), tool:write(*.exs)"
condition:
  - '\bTask\.(?:start|start_link|async)\s*\('
interruptMode: always
---

# Pelanggaran Hukum Besi #12: Unsupervised Task di BEAM / OTP

Anda terdeteksi memanggil `Task.start/1`, `Task.start_link/1`, atau `Task.async/1` secara langsung tanpa supervisi.

### Mengapa Dilarang?
Membuat proses asynchronous tanpa berada di bawah pohon pengawasan (*Supervision Tree*) melanggar prinsip *fault-tolerance* BEAM:
1. **Crash Terikat / Zombie Process**: `Task.start/1` menghasilkan proses tanpa supervisor yang bila terjadi crash tidak akan terpantau dan dapat meninggalkan resource yang bocor (*leaked resources*).
2. **Kaskade Kegagalan**: `Task.async/1` melakukan link ke proses pemanggil. Jika task mengalami timeout atau crash, proses pemanggil (seperti LiveView channel atau HTTP request) akan ikut mati seketika.

### Solusi Wajib:
1. **Gunakan `Task.Supervisor` Terdaftar**:
   ```elixir
   # Jalankan fire-and-forget dengan supervisi:
   Task.Supervisor.start_child(MyApp.TaskSupervisor, fn ->
     MyApp.Analytics.record_event(event)
   end)

   # Atau jalankan async terisolasi tanpa link fatal:
   Task.Supervisor.async_nolink(MyApp.TaskSupervisor, fn ->
     MyApp.ExternalAPI.fetch_data()
   end)
   ```
2. **Gunakan Oban untuk Pekerjaan Kritis / Background Jobs**:
   Jika pekerjaan memerlukan jaminan eksekusi (*durability*), retries otomatis, atau penjadwalan, gunakan worker Oban:
   ```elixir
   %{user_id: user.id}
   |> MyApp.Workers.WelcomeEmail.new()
   |> Oban.insert()
   ```
