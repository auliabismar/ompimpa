# Pitfalls — Pola Kegagalan & Solusi Teruji (Auto-Append via Triage)

> **Sumber:** Setiap `REMEDIATE` sukses (P0/P1) → append entry baru via `src/triage.ts:appendPitfall()` + indeks ` _ompimpa/solutions/SOL-*.md` (compound memory).
> Port `pitfalls_manager.py` 18KB agyimpa → TS native. Inject ke prompt via `compound-solutions` skill sebelum `ompimpa-debug`.

## Format Entry

```markdown
### [2026-09-02] IL-01 float→decimal (P1 REMEDIATE — C-03)
- **Gejala:** `field :balance, :float` lolos TTSR, scoring -30 Critical
- **Akar:** `rules/01-no-float-money.md` pattern `:\w+\s*,\s*:float` tidak cover `field :price, :float`
- **Solusi Teruji:** `ubah field :balance, :float → field :balance, :decimal + cast/validate decimal`
- **File:** `lib/accounts.ex:42` → `lib/accounts.ex:42` (patch `+ field :balance, :decimal`)
- **Invariant:** `field :*\b, :float` selalu BLOCK; remediation `gunakan :decimal atau integer cents`
- **SOL:** `SOL-001-float-decimal.md`
```

---

### [2026-09-02] IL-01 float→decimal — Contoh Seed (P1 High → PASS 100)

- **Gejala:** `lib/transactions.ex:18 field :amount, :float` terdeteksi rule `01-no-float-money` sebagai Critical (-30).
- **Akar Penyebab:** Developer menggunakan `:float` untuk uang karena contoh Phoenix generik.
- **Pola Solusi Terbukti:**

  ```elixir
  # sebelum (REMEDIATE)
  field :amount, :float

  # sesudah (PASS 100)
  field :amount, :decimal
  # changeset: cast(attrs, [:amount]) |> validate_required([:amount])
  ```

- **Invariant Pencegahan Regresi:**
  1. `grep -R "field :.*:float" lib/` harus 0 hit sebelum commit.
  2. `loadPrewalkRules()` TTSR `01-no-float-money` abort dengan remediation `gunakan :decimal atau integer cents` di line tepat.
  3. Triage dedup `file:line:ruleId` 3 laporan → 1 entitas, penalty 1× -30 (B-02).

- **SOL Terdokumentasi:** `_ompimpa/solutions/SOL-001-float-decimal.md` (compound memory)

---

### [2026-09-02] IL-04 no-raw-sql-interpolation — Seed (P0 Critical)

- **Gejala:** `Repo.query("SELECT * FROM users WHERE id = #{id}")` terdeteksi `04-no-raw-sql-interpolation` Critical.
- **Solusi:** `Repo.query("SELECT * FROM users WHERE id = $1", [id])` atau `from(u in User, where: u.id == ^id)`.
- **Invariant:** Raw interpolation `#{}` di SQL string selalu BLOCK.


### [2026-09-08] IL-03 LiveView Stream Enumeration Crash (P0 Blocker)
- **Gejala:** `Enum.map(@streams.xyz, ...)` di template HEEx memicu `Protocol.UndefinedError: protocol Enumerable not implemented for Phoenix.LiveView.Stream`.
- **Akar Penyebab:** Phoenix LiveView Stream bukan Enumerable, didesain hanya untuk DOM stream generator via `id={dom_id}`.
- **Solusi:** Simpan assign terpisah yang ringan di socket (cth: `@visible_ids`) untuk kebutuhan ekstraksi daftar ID seleksi.
- **Invariant:** Dilarang meng-enumerate `@streams` di HEEx template.
- **SOL:** `_ompimpa/solutions/SOL-002-liveview-stream-enumeration.md`

---

### [2026-09-08] Tailwind v4 Checkbox Accent (P1 UI/UX)
- **Gejala:** Checkbox tetap berwarna hitam pekat di peramban modern meskipun memakai `text-sky-600`.
- **Akar Penyebab:** Tailwind CSS v4 memerlukan properti CSS `accent-color` (`accent-*`) untuk kontrol form native.
- **Solusi:** Tambahkan kelas semantik `accent-sky-600` (atau `accent-primary`) pada seluruh checkbox.
- **Invariant:** Checkbox form/tabel wajib menyertakan kelas utilitas `accent-*`.
- **SOL:** `_ompimpa/solutions/SOL-003-tailwind-v4-checkbox-accent.md`

---

### [2026-09-08] Zero-Tolerance Modal CRUD (P0 Blocker / Iron Law)
- **Gejala:** Pengembang atau subagent secara berulang membuat atau mempertahankan popup `<.modal>` untuk aksi create/edit formulir master/transaksi.
- **Akar Penyebab:** Generator default Phoenix menggunakan modal dan ketiadaan linter mekanis pemblokir di precommit.
- **Solusi:** Wajib rute halaman penuh terdedikasi (`/baru` dan `/:id/ubah`) dengan `<.form_workspace>` + borgol linter `scripts/audit_iron_laws.sh` pada precommit.
- **Invariant:** Modal HANYA untuk konfirmasi destruktif tanpa input form.
- **SOL:** `_ompimpa/solutions/SOL-004-modal-crud-iron-law-linter.md`

---

### [2026-09-08] List Workspace Dual Action Buttons (P1 Blocker)
- **Gejala:** Muncul 2 tombol "+ Tambah" di header tabel karena komponen me-render `new_navigate` dan `<:actions>` bersamaan.
- **Akar Penyebab:** Tidak ada logika eksklusif pada layout header list workspace.
- **Solusi:** Terapkan gerbang tunggal: jika slot `<:actions>` ada, sembunyikan tombol default `new_navigate`.
- **Invariant:** Header list workspace maksimal me-render 1 tombol primer untuk aksi yang sama.
- **SOL:** `_ompimpa/solutions/SOL-005-list-workspace-dual-action-gate.md`

---

### [2026-09-08] Bulk Selection Stream Desync (P0 Blocker)
- **Gejala:** State centang Select All di server tidak merefleksikan tampilan checkbox di browser (*Stream Freeze Bug*).
- **Akar Penyebab:** Container `phx-update="stream"` tidak memperbarui DOM baris saat socket assigns server berubah.
- **Solusi:** Koordinasikan via event `bulk-selection-sync` + JS Hook `BulkSelectionCoordinator` untuk mutasi status DOM checkbox klien.
- **Invariant:** Seluruh tabel stream berseleksi massal wajib menyertakan sinkronisasi client-server terkoordinasi.
- **SOL:** `_ompimpa/solutions/SOL-006-bulk-selection-stream-sync.md`
---

## Auto-Append Hook

- **Trigger:** `triage.ts` dedup → scoring `REMEDIATE` → commit sukses → `appendPitfall()` tulis entry baru + `SOL-XXX` ter-index.
- **Compound Memory:** Sebelum investigasi bug, `ompimpa-debug` memindai `_ompimpa/solutions/` untuk pola cocok (IR `pitfalls.md`).
- **Kill Criteria:** Jika `pitfalls.md` >500 baris → rotasi ke `_ompimpa/solutions/archive/`.
