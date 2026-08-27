---
description: "Mencegah bypass kebijakan otorisasi via authorize?: false pada modul domain non-testing (Hukum Besi #23)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - '\bAsh\.(?:create|update|destroy|read|bulk_create|bulk_update)!?\([^)]*authorize\?:\s*false'
interruptMode: always
---

# Pelanggaran Hukum Besi #23: Unauthorized Policy Bypass di Ash Framework

Anda terdeteksi menggunakan opsi `authorize?: false` pada pemanggilan aksi domain Ash Framework di dalam kode aplikasi produksi (`*.ex`).

### Mengapa Dilarang?
Opsi `authorize?: false` menonaktifkan seluruh pemeriksaan `Ash.Policy.Authorizer`. Jika digunakan di dalam alur logika bisnis atau modul domain:
1. **Risiko IDOR (Insecure Direct Object Reference)**: Pengguna dapat mengakses atau memodifikasi record milik entitas/pengguna lain hanya dengan menebak ID.
2. **Kebocoran Multi-Tenant**: Pembatas tenant (*tenant scoping*) di-bypass secara paksa.
3. **Melanggar Prinsip Zero-Trust**: Otorisasi harus ditegakkan secara *fail-closed* di tingkat Resource.

> ℹ️ *Pengecualian: `authorize?: false` hanya diizinkan di dalam berkas pengujian (`test/**/*_test.exs`) atau seed data (`priv/repo/seeds.exs`).*

### Solusi Wajib:
1. **Sematkan Aktor (`actor`) dan Tenant (`tenant`) yang Valid**:
   ```elixir
   # Jalankan aksi dengan konteks pengguna aktif:
   MyApp.Helpdesk.create_ticket(params, actor: current_user, tenant: current_tenant)
   ```

2. **Gunakan Kebijakan Otorisasi Sistemik (*Bypass Block*) Jika Benar-Benar Diperlukan**:
   Definisikan kondisi bypass secara deklaratif di Resource, bukan dengan mem-bypass saat pemanggilan aksi:
   ```elixir
   policies do
     # Bypass resmi untuk service account atau background worker internal:
     bypass actor_attribute_equals(:role, :system_worker) do
       authorize_if always()
     end

     policy action_type(:create) do
       authorize_if expr(tenant_id == ^actor(:tenant_id))
     end
   end
   ```
