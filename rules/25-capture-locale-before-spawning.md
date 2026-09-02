---
description: "Mewajibkan penangkapan Gettext/CLDR locale sebelum memicu Task atau GenServer baru (Hukum Besi #21)"
globs: ["*.ex"]
scope: "tool:edit(*.ex), tool:write(*.ex)"
condition:
  - 'Gettext\.get_locale'
  - 'CLDR\.get_locale'
interruptMode: always
---

# Pelanggaran Hukum Besi #25: Process-Local Locale Capture

Anda terdeteksi memicu Task/GenServer tanpa capture locale.

### Mengapa Dilarang?
Locale Gettext/CLDR bersifat process-local; task baru kehilangan locale, rendering tanggal/mata uang salah.

### Solusi Wajib:
```elixir
locale = Gettext.get_locale(MyApp.Gettext)
Task.Supervisor.start_child(MyApp.TaskSupervisor, fn ->
  Gettext.put_locale(MyApp.Gettext, locale)
  do_work()
end)
```
