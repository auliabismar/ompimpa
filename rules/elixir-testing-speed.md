---
description: "Larangan mutlak Process.sleep dan ambang batas kecepatan pengujian in-band <= 50ms (TEA-08 / TEA-26)"
globs: ["*_test.exs", "*.test.ts", "*.test.js", "*.spec.ts", "*.spec.js"]
scope: "tool:edit(*_test.exs), tool:write(*_test.exs)"
condition:
  - '(?:Process|:timer)\.sleep\s*[\(\s]'
interruptMode: always
---

# Aturan Mutu Pengujian In-Band: Anti-Flaky & Test Speed Guard (TEA-08 / TEA-26)

Anda terdeteksi menggunakan `Process.sleep` atau fungsi penundaan waktu sembarangan pada berkas pengujian, atau pengujian melebihi ambang batas kecepatan in-process.

### Mengapa Dilarang?
1. **Flaky Test Hazard**: `Process.sleep/1` dan penundaan waktu tetap (*fixed sleep*) mengikat durasi tes ke jam dinding (*wall-clock*). Hal ini menyebabkan pengujian lambat, tidak deterministik, dan rentan gagal di lingkungan CI di bawah beban tinggi (*race condition*).
2. **In-Band Latency Boundary**: Seluruh pengujian in-process `Phoenix.LiveViewTest` dan unit test ExUnit wajib tuntas dalam waktu $\le 50\text{ ms}$. Pengujian yang lambat memperlambat dev loop dan merusak pengalaman pengembang (*DX*).

### Solusi Wajib:
1. **Gunakan Sinkronisasi Deterministik dengan `assert_receive`**:
   Alih-alih menunggu dengan `Process.sleep`, tangkap pesan proses secara langsung:
   ```elixir
   # ❌ DILARANG:
   send(lv.pid, {:data_updated, payload})
   Process.sleep(100)
   assert render(lv) =~ "Updated"

   # ✅ DIANJURKAN:
   send(lv.pid, {:data_updated, payload})
   assert_receive {:data_updated_done, ^payload}, 500
   assert render(lv) =~ "Updated"
   ```

2. **Sinkronisasi Phoenix LiveViewTest**:
   Gunakan helper pengujian LiveView resmi yang secara otomatis menunggu event selesai diproses:
   ```elixir
   # ✅ DIANJURKAN:
   assert render_submit(form) =~ "Berhasil"
   assert render_change(form, %{field: "val"}) =~ "Valid"
   ```

3. **Optimasi Performa Pengujian (< 50ms)**:
   - Gunakan isolasi sandbox database `Ecto.Adapters.SQL.Sandbox.checkout/2`.
   - Hindari I/O disk atau panggilan HTTP eksternal yang tidak diperlukan.
   - Pindahkan data mocking ke fixture memori ringan.
