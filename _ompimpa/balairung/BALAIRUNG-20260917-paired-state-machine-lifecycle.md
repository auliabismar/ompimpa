# Risalah Balairung: Reformasi State Machine Berpasangan Siklus Hidup Story & Adjudikasi Triage
- **Tanggal & Waktu:** 2026-09-17 17:15 UTC
- **ID:** BALAIRUNG-20260917-PAIRED-STATE-MACHINE
- **Pimpinan Majelis:** Pengguna / Ketua Sidang
- **Komposisi Anggota:**
  - Tan Malaka (`ompimpa-triz` — Analisis Madilog & Dinamika TRIZ)
  - H. Agus Salim (`ompimpa-prd` — Arsitek Kontrak & Spesifikasi Referensi)
  - Tuanku Imam Bonjol (`ompimpa-test` — Benteng Pertahanan Mutu & ATDD)
  - Hj. Rasuna Said (`ompimpa-ironlaw` — Penegak Hukum Besi & Integritas Semantik)
  - Djamaluddin Adinegoro (`ompimpa-debug` — Kausalitas & Observabilitas)
- **Mode Sidang:** Tematik Arsitektur & Tata Kelola Status Eksekusi

---

## 1. Topik Musyawarah & Konteks Keputusan

Sidang dibuka untuk membedah kelemahan empiris dari status siklus hidup cerita (*story lifecycle*) saat ini pada `_ompimpa/status/feature-status.yaml` yang hanya mengenal 6 status linier naif:
$$\text{backlog} \longrightarrow \text{ready-for-atdd} \longrightarrow \text{ready-for-dev} \longrightarrow \text{in-progress} \longrightarrow \text{in-review} \longrightarrow \text{done}$$

### Masalah Empiris di Lapangan:
1. **Denda Komputasi Akibat Crash (*Resumability Failure*)**: Jika sesi review atau triage mengalami *timeout* atau *interrupted* di menit ke-9 (seperti insiden pada story 20-3 di repositori `mimar`), sistem lama memaksa mengulang kelima fase (`/story`, `/atdd`, `/code`, `/review`, `/triage`) dari awal. Padahal berkas SPEC dan tes ATDD merah sudah selesai dan valid.
2. **Ketiadaan Status Granular saat Perbaikan**: Status `in-progress` menyamarkan koding awal normal dengan siklus perbaikan (*remediation*) temuan review, sehingga pengembang dan dashboard pemantau tidak tahu apakah story sedang koding biasa atau sedang berjuang memperbaiki cacat.
3. **Celah Desinkronisasi Git vs Disk State**: Status `done` dapat tertulis di disk sementara perubahan pada git working tree belum ter-commit.
4. **Kebutuhan Yurisdiksi Triage**: Perlunya pemisahan yang jelas antara keputusan yang boleh diambil model secara otomatis vs keputusan yang wajib dieskalasi ke manusia (khususnya pada 4 lensa review kebutuhan BMAD).

---

## 2. Risalah Ronde 1: Posisi Awal Dewan

### 1. H. Agus Salim (`ompimpa-prd`)
- **Sikap:** Mendukung reformasi status berpasangan.
- **Argumen [FACT]:** Status `done` tanpa tautan commit SHA terbukti memicu silent-skip pada loop berikutnya.
- **Usulan:** Setiap status transisi wajib mencatat berkas pembuktian (`checkpoint`).

### 2. Tan Malaka (`ompimpa-triz`)
- **Sikap:** Sangat mendukung; ini resolusi kontradiksi efisiensi vs determinisme (TRIZ #10 Checkpointing & TRIZ #15 Dynamics).
- **Argumen [INFERENCE]:** Rantai linier monolitik memboroskan token. Loop perbaikan pasca-triage tidak boleh mundur ke fase story atau ATDD. Status `ready-for-patch` harus memotong jalan (*shortcut*) langsung ke fase koding run ke-N.

### 3. Tuanku Imam Bonjol (`ompimpa-test`)
- **Sikap:** Menyetujui dengan syarat gerbang bukti fisik.
- **Argumen [FACT]:** `ready-for-dev` dilarang terbit sebelum ada berkas tes merah yang terbukti gagal secara substantif.

### 4. Hj. Rasuna Said (`ompimpa-ironlaw`)
- **Sikap:** Menyetujui dengan perlindungan atomisitas.
- **Argumen [FACT]:** Status `done` wajib bersyarat *git clean*. Jika working tree kotor, status dilarang ditulis `done`.

### 5. Djamaluddin Adinegoro (`ompimpa-debug`)
- **Sikap:** Menyetujui; meningkatkan observabilitas.
- **Argumen [INFERENCE]:** Dengan atribut `run`, `last_error`, dan `checkpoint`, eksekusi dapat di-resume via `ompimpa dev --resume` tanpa tebak-tebakan.

---

## 3. Risalah Ronde 2: Debat Silang & Dialektika

- **Dialektika 1 — Tan Malaka vs H. Agus Salim mengenai Kompleksitas Parser**:
  Agus Salim mengkhawatirkan apakah penambahan field metadata pada YAML akan memperlambat parsing. Tan Malaka menyanggah bahwa denda token akibat re-run 5 fase dari awal (>50.000 token per story) jauh lebih mahal daripada beberapa baris metadata YAML. Mufakat tercapai: metadata diletakkan di dalam sub-blok `checkpoint:`.
- **Dialektika 2 — Rasuna Said vs Adinegoro mengenai Keputusan Model di Triage**:
  Adinegoro mengusulkan model leluasa mengadjudikasi sengketa agar loop tidak terhenti. Rasuna Said menolak keras jika menyangkut 26 Hukum Besi Elixir (Statutori). Mufakat tercapai: Aturan statutori bersifat *non-negotiable*; model hanya boleh mengadjudikasi temuan heuristik/BMAD dengan pencatatan wajib di *Adjudication Ledger*.

---

## 4. Keputusan Akhir & Mufakat (The Verdict)

Ketua Sidang mengetuk palu dan **mengesahkan secara bulat (5/5 Mufakat)** reformasi state machine:

### A. Rantai Siklus Hidup Berpasangan Kanonis (*Two-Tier Paired Lifecycle*)

$$\begin{aligned}
\text{backlog} 
&\longrightarrow \text{in-story} \longrightarrow \mathbf{ready\text{-}for\text{-}atdd} \\
&\longrightarrow \text{in-atdd} \longrightarrow \mathbf{ready\text{-}for\text{-}dev} \\
&\longrightarrow \text{in-dev} \longrightarrow \mathbf{ready\text{-}for\text{-}review} \\
&\longrightarrow \text{in-review} \longrightarrow \mathbf{ready\text{-}for\text{-}triage} \\
&\longrightarrow \text{in-triage} \longrightarrow 
\begin{cases} 
\mathbf{done} & \text{(skor 100/100, git commit SHA tercatat)} \\
\mathbf{ready\text{-}for\text{-}patch} \longrightarrow \text{in-dev} & \text{(remediasi terarah, run 1..3)} 
\end{cases}
\end{aligned}$$

### B. Struktur Referensi pada `_ompimpa/status/feature-status.yaml`
```yaml
stories:
  - id: <STORY_ID>
    title: "<Judul Story>"
    status: ready-for-patch          # Status kanonis saat ini
    run: 2                           # Running / attempt ke berapa
    epic: <EPIC_ID>
    checkpoint:
      phase: triage                  # Fase terakhir yang terselesaikan
      spec: _ompimpa/specs/SPEC-<ID>.md
      test_files:
        - test/..._test.exs
      files_touched:
        - lib/...
      review_artifacts:
        - _ompimpa/review/<ID>-ompimpa-ironlaw.json
      triage_verdict:
        score: 85
        verdict: REMEDIATE
        blockers: 0
        warnings: 1
        summary: "Ringkasan temuan perbaikan"
      commit: "5783a7e"              # Terisi SHA hanya saat status done
    retries: 1
```

### C. Matriks Yurisdiksi Triage (Manusia vs Model) & Adjudication Ledger
1. **Otoritas Model (Otomatis)**:
   - Deduplikasi temuan leksikal & lokasi identik.
   - Pembuktian *False-Positive* berbantu kode (disproof nyata).
   - Rekonsiliasi saran refaktor antar-spesialis stack.
2. **Eskalasi Wajib ke Manusia**:
   - Pertentangan Niat (*Intent Drift*) pada 4 Lensa Kebutuhan BMAD.
   - Ambiguitas Lingkup (*Scope Creep* vs *Completeness*).
   - Seluruh Pelanggaran Hukum Besi Elixir (Non-negotiable).
   - Ambang Circuit Breaker tercapai (`retries >= 3`).
3. **Perekaman Keputusan Model (*Adjudication Ledger*)**:
   Seluruh vonis pembatalan atau penyesuaian temuan oleh model wajib disimpan di `_ompimpa/triage/<ID>-adjudication.json` dan di-append ke seksi `## 11. Review Triage Log` pada SPEC.

---

## 5. Tabel Inventaris Modul & Rute (INV-10)

Sesuai Invarian INV-10, keputusan arsitektur ini memetakan dampak langsung pada komponen inti OMP-IMPA:

| Modul | Berkas Implementasi | Rute / Subcommand | Status Perubahan | Komponen Wajib |
|---|---|---|---|---|
| **Lifecycle State Machine** | `src/status.ts` | CLI / Engine Internal | Ubah | `STATUS_ORDER`, `statusRank`, `canAdvance`, `canWriteStatus` |
| **Pipeline Runner & Resumability** | `src/loop_runner.ts` | `ompimpa dev --resume` | Ubah | `runStoryPhases`, `runEpicLoop`, `updateFeatureStatus`, `commitStoryChanges` |
| **CLI Dispatcher & Status** | `src/cli.ts` | `ompimpa status <ID>` | Ubah | `handleStatus`, `handleDev`, parsing metadata `checkpoint` |
| **Triage & Adjudication Ledger** | `src/triage.ts`, `src/mini_balairung.ts` | `ompimpa triage <ID>` | Ubah | `detectContestedFindings`, `runAdjudicationTask`, penulisan ledger JSON |
| **TUI Monitor Display** | `src/tui/panes/stories.ts` | `ompimpa monitor` | Ubah | Visualisasi badge status berpasangan (`in-*` vs `ready-for-*`) |

---

## 6. Kill Criteria (Batas Pembatalan Keputusan)

1. **Regresi Performa**: Jika overhead I/O penulisan blok `checkpoint:` pada `feature-status.yaml` menambah latensi fase > 100ms, struktur metadata disederhanakan menjadi single-line JSON.
2. **Deadlock Resume**: Jika fungsi `canAdvance` menyebabkan kegagalan transisi sah pada saat me-resume story yang crash, logika guard dikembalikan sementara ke mode permisif.

---

## 7. Rekomendasi Tindak Lanjut

Sidang resmi **ditutup**. Palu mufakat telah diketuk. Tindakan konkret selanjutnya:
1. Dokumentasikan keputusan ini ke dalam dokumen **ADR-007 (Architecture Decision Record)** standar MADR:
   ```bash
   /ompimpa:adr "Reformasi Paired State Machine dan Adjudication Ledger Triage"
   ```
2. Lakukan implementasi pembaruan kode pada `src/status.ts` dan `src/loop_runner.ts` sesuai rancangan mufakat ini.
