---
description: Menjalankan master diagnostic out-of-band terpadu (Boundaries, Performa, Keamanan, Docs) dan otomatis menerbitkan backlog EPIC-DEBT
story: E-03
epic: EPIC-E
rule: INV-11
---

# Command: /ompimpa:inspect (Master Diagnostic Out-of-Band)

Menjalankan pemindaian diagnostik menyeluruh pada seluruh codebase sistem Phoenix/Elixir di luar siklus pengerjaan story aktif (*out-of-band*). Perintah ini menyatukan 4 pilar audit arsitektural yang sebelumnya terpecah (`audit`, `boundaries`, `perf`, dan `techdebt`) ke dalam satu mesin inspeksi terpadu:

$$\text{Master Inspect} = \underbrace{\text{Batas}}_{\text{TEA-15/16}} + \underbrace{\text{Performa}}_{\text{TEA-26}} + \underbrace{\text{Keamanan}}_{\text{TEA-08}} + \underbrace{\text{Docs \& Techdebt}}_{\text{TEA-35}}$$

> 🛡️ **Invarian INV-11 (Out-of-Band Inspection Isolation — ADR-002):**  
> Perintah `/inspect` beroperasi murni *out-of-band* dan **DILARANG KERAS** memutasi status story aktif pada `_ompimpa/status/feature-status.yaml`.  
> Seluruh temuan kritis (P0/P1) wajib disalurkan secara tertib melalui penerbitan story baru di bawah `EPIC-DEBT` pada `_ompimpa/stories.yaml`, sedangkan temuan non-kritis (P2/P3) dicatat ke `_ompimpa/deferred.md`.

---

## 4 Pilar Inspeksi Terpadu

1. **Pilar Batas (Boundaries & Modular Architecture — TEA-15, TEA-16):**
   - Mendeteksi ketergantungan melingkar (*circular dependencies*) antar-modul dan antar-konteks via graph analisis.
   - Memvalidasi integritas DAG `stories.yaml` agar bebas dari siklus.
   - Menganalisis *cross-context blast-radius* dan pelanggaran batas domain modular.

2. **Pilar Performa (NFR Latency & Efficiency — TEA-26):**
   - Memverifikasi konfigurasi bertingkat (*tiered verification* T1 < 2s, T2 < 10s, T3 background).
   - Memindai durasi eksekusi graphify dan kompilasi terhadap ambang batas latensi NFR.
   - Mendeteksi potensi anti-pattern kueri N+1 pada rendering template atau iterasi Repo.
   - Memeriksa kebersihan memori assign LiveView (*assigns memory hygiene*).

3. **Pilar Keamanan (Security, OWASP, & Iron Laws — TEA-08):**
   - Memeriksa ketersediaan dan integritas 26 berkas 1:1 Hukum Besi Elixir (`rules/01-..26-*.md`).
   - Memvalidasi ketersediaan katalog *pitfalls* terintegrasi (`rules/pitfalls.md`).
   - Memeriksa keberadaan linter keamanan `sobelow` dan `credo` pada pipeline konfigurasi.

4. **Pilar Docs & Techdebt (Diátaxis Completeness & Clean Code — TEA-35):**
   - Memvalidasi kelengkapan 4 kuadran Diátaxis (`tutorials/`, `how-to/`, `reference/`, `explanation/`).
   - Memastikan ketiadaan *placeholders* atau `TODO:` pada dokumentasi resmi.
   - Mendeteksi kode mati (*dead code*) dan fungsi tak terjangkau via `mix xref unreachable`.

---

## Penggunaan

### Di Dalam Sesi OMP Harness
```bash
/ompimpa:inspect               # Menjalankan master diagnostic 4 pilar lengkap
/inspect                       # Alias singkat
/ompimpa:inspect --boundaries  # Khusus memindai pilar batas & circular dependencies
/ompimpa:inspect --perf        # Khusus memindai pilar performa & latensi NFR
/ompimpa:inspect --keamanan    # Khusus memindai pilar keamanan & 26 Iron Laws
/ompimpa:inspect --docs        # Khusus memindai pilar dokumentasi Diátaxis
/ompimpa:inspect --dry-run     # Pratinjau hasil pemindaian tanpa menulis stories.yaml
```

### Melalui CLI Terminal
```bash
ompimpa inspect                # Menjalankan master diagnostic dari CLI
ompimpa inspect --dry-run      # Menjalankan inspeksi dalam mode baca-saja
ompimpa inspeksi               # Alias backward-compatible
```

---

## Alur Kerja Otomatisasi Backlog (Closed-Loop Self-Healing)

```
                       ┌───────────────────────────────┐
                       │   ompimpa inspect / /inspect  │
                       └───────────────┬───────────────┘
                                       │
                         [Evaluasi 4 Pilar Scorecard]
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
      [Temuan P0 / P1 Kritis]                    [Temuan P2 / P3 Non-Kritis]
  (Circular dependency, NFR latency)           (Missing docs, minor linter note)
                 │                                           │
                 ▼                                           ▼
    Otomatis terbitkan User Story                Catat entri hutang teknis ke:
        di bawah `EPIC-DEBT`                      `_ompimpa/deferred.md`
      pada `_ompimpa/stories.yaml`
                 │                                           │
                 └─────────────────────┬─────────────────────┘
                                       ▼
                       Scorecard 4 Pilar diterbitkan ke:
                        `_ompimpa/inspeksi/report.md`
```

### Format Story yang Dihasilkan (`_ompimpa/stories.yaml`)
Story perbaikan hutang teknis otomatis dilengkapi metadata terstruktur:
- **Epic ID:** `EPIC-DEBT` ("Hutang Teknis Arsitektural & Performa")
- **Story ID:** `DEBT-BND-<N>` (Batas) atau `DEBT-PRF-<N>` (Performa)
- **Kriteria Penerimaan (AC Gherkin):** Terdefinisi dengan klausa `Given`, `When`, `Then` yang siap diuji oleh ATDD.
- **Target Files:** Berkas sumber yang relevan dengan akar penyebab temuan.

---

## Artefak Keluaran

1. `_ompimpa/inspeksi/report.md`: Laporan visual kartu skor 4 pilar (skor 0–100, status pilar, rincian isu, dan rekomendasi mitigasi).
2. `_ompimpa/stories.yaml`: Backlog story baru di bawah `EPIC-DEBT` (jika ditemukan temuan P0/P1).
3. `_ompimpa/deferred.md`: Daftar penundaan hutang teknis non-kritis (jika ditemukan temuan P2/P3).
