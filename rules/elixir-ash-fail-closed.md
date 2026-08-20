---
description: "Mencegah pembuatan kebijakan otorisasi Ash tanpa penolakan default / fail-closed (Hukum Besi #23)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'policies\s+do[\s\n]+policy\s+always\(\)\s+do[\s\n]+authorize_if'
interruptMode: always
---

# Pelanggaran Hukum Besi #23: Ash Resource Policy Fail-Closed

Anda terdeteksi mendefinisikan kebijakan otorisasi Ash dengan aturan permisif tanpa penegakan *default deny / fail-closed*.

### Mengapa Dilarang?
Prinsip keamanan *Zero-Trust* mewajibkan seluruh resource data menolak akses secara default (*fail-closed*). Mengizinkan akses tanpa otorisasi eksplisit membuka risiko eskalasi hak akses (*privilege escalation*) dan kebocoran data multi-tenant.

### Solusi Wajib:
Rancang blok `policies` dengan prinsip *default deny*:
```elixir
policies do
  # Tolak seluruh akses jika tidak memenuhi kondisi eksplisit:
  default_access_type :deny

  policy action_type(:read) do
    authorize_if expr(user_id == ^actor(:id))
  end
end
```
Atau gunakan `authorize_if` ketat berbasis aktor.
