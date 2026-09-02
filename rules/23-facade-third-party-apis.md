---
description: "Mewajibkan pembungkusan library pihak ketiga di balik modul facade/adapter (Hukum Besi #17)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'HTTPoison\.get!'
  - 'Req\.get!'
  - 'Tesla\.get'
  - '\bAsh\.(?:create|update|destroy|read|bulk_create|bulk_update)!?\([^)]*authorize\?:\s*false'
interruptMode: always
---

# Pelanggaran Hukum Besi #23: Wrap Third-Party Library APIs

Anda terdeteksi memanggil library pihak ketiga langsung tanpa facade.

### Mengapa Dilarang?
Direct call sulit di-mock/test dan perubahan API vendor merambat ke seluruh codebase.

### Solusi Wajib:
```elixir
defmodule MyApp.HttpClient do
  @callback get(url :: String.t()) :: {:ok, term()} | {:error, term()}
  def get(url), do: Req.get!(url)
end
```
