# ADR-007: Reformasi Paired State Machine Lifecycle dan Adjudication Ledger Triage

> **Status:** Accepted — 2026-09-17  
> **Deciders:** Dewan Balairung Sari (H. Agus Salim, Tan Malaka, Tuanku Imam Bonjol, Hj. Rasuna Said, Djamaluddin Adinegoro) & Ketua Sidang  
> **Rujukan:** `_ompimpa/balairung/BALAIRUNG-20260917-paired-state-machine-lifecycle.md`  
> **Tags:** `lifecycle`, `state-machine`, `checkpointing`, `resumability`, `triage`, `adjudication-ledger`, `MADR-3.0`  
> **Supersedes:** —  
> **Amends:** `ADR-001`, `ADR-002`, `src/status.ts`, `src/loop_runner.ts`, `src/triage.ts`, `src/mini_balairung.ts`

---

## 1. Context and Problem Statement

Setelah penerapan pipeline modular 5 fase (`/story` → `/atdd` → `/code` → `/review` → `/triage`) pada ADR-002, evaluasi empiris pada proyek nyata (khususnya insiden pada repositori `mimar`) mengungkap 3 kelemahan mendasar dalam pengelolaan status cerita:

1. **Denda Komputasi Akibat Interupsi (*Resumability Failure*)**: Status siklus hidup saat ini bersifat linier naif (`backlog → ready-for-atdd → ready-for-dev → in-progress → in-review → done`). Ketika sebuah sesi terputus di tengah jalan (misalnya timeout sesi review selama 600.000ms pada story 20-3), sistem `runStoryPhases` tidak memiliki mekanisme checkpoint parsial dan terpaksa mengulang seluruh 5 fase dari awal, membakar puluhan ribu token untuk artefak yang sebenarnya sudah valid.
2. **Ketiadaan Status Granular saat Remediasi**: Siklus implementasi kode awal (`/code`) dan siklus perbaikan cacat hasil audit review disatukan di bawah status monolitik `in-progress`. Dashboard pemantau TUI dan developer tidak dapat membedakan apakah sebuah story sedang koding normal atau sedang berjuang menyelesaikan temuan penolakan review.
3. **Desinkronisasi Status vs Git Commit**: Ditemukan celah di mana status disk (`feature-status.yaml`) dapat menandai `done` sebelum perubahan pada *working tree* berhasil di-commit secara sah oleh Git, mengakibatkan perubahan tertinggal kotor dan terlewati pada loop berikutnya.
4. **Kebutuhan Yurisdiksi Triage (Manusia vs Model)**: Pada evaluasi 4 Lensa Kebutuhan BMAD (`bmad_adversarial`, `bmad_gap_verifier`, `bmad_structural`, `bmad_completeness`), sering terjadi *contested findings* (sengketa temuan) antara interpretasi AI reviewer dengan maksud asli produk/pengembang. Dibutuhkan batas yurisdiksi yang tegas mengenai apa yang boleh diputuskan model secara otomatis vs apa yang wajib dieskalasi ke manusia, serta audit trail keputusannya.

---

## 2. Decision Drivers

* **D1 — Resumability Tanpa Denda Komputasi (TRIZ #10 Checkpointing)**: Kegagalan pada fase hilir (seperti review atau triage) dilarang mengulang fase hulu yang sudah valid (seperti JIT spec atau ATDD merah). Sistem harus mampu melanjutkan (*resume*) tepat dari checkpoint terakhir.
* **D2 — Granularitas Pemantauan Loopback (TRIZ #15 Dynamics)**: Siklus perbaikan kode pasca-penolakan review harus memiliki penanda eksplisit (`ready-for-patch`), bukan menyamar sebagai koding awal.
* **D3 — Atomisitas Status Done & Git State (Zero Uncommitted Delta)**: Status `done` dan Git Commit harus terikat sebagai satu kesatuan atomik yang mencatat commit SHA di berkas status.
* **D4 — Integritas Statutori Non-Negotiable (Iron Law Shield)**: Model AI dilarang keras mengadjudikasi atau membatalkan pelanggaran 26 Hukum Besi Elixir; hukum statutori hanya boleh diselesaikan dengan perbaikan kode nyata.
* **D5 — Audit Trail Keputusan Model (Adjudication Ledger)**: Setiap pembatalan temuan atau penyelarasan sengketa oleh model di Mini Balairung (Tier 2.5) wajib terdokumentasi dan dapat diaudit oleh manusia.

---

## 3. Considered Options

### Opsi A — Mempertahankan Status Linier 6-State dengan Patch Hardcoded
Mempertahankan urutan status lama (`backlog → ready-for-atdd → ready-for-dev → in-progress → in-review → done`) dan hanya menambahkan retry counter.
* **Kelemahan:** Tetap tidak memiliki kapabilitas *resume* per-fase, tidak membedakan koding vs perbaikan, dan gagal mencegah status mendahului commit git.

### Opsi B — Two-Tier Paired State Machine dengan Checkpoint Metadata & Adjudication Ledger (Dipilih)
Mendekomposisi setiap fase menjadi pasangan status: **"In-Phase"** (sedang berproses) dan **"Ready-For-Next"** (hasil material terverifikasi siap melangkah), dilengkapi sub-blok `checkpoint:` pada YAML dan Adjudication Ledger terstruktur.

---

## 4. Decision Outcome

**Dipilih Opsi B.**

### 1. Rantai Siklus Hidup Berpasangan Kanonis (*Two-Tier Paired State Machine*)

Status transisi kini diatur secara berpasangan maju (*never-regress order*):

$$\begin{aligned}
\text{backlog} 
&\longrightarrow \text{in-story} \longrightarrow \mathbf{ready\text{-}for\text{-}atdd} \\
&\longrightarrow \text{in-atdd} \longrightarrow \mathbf{ready\text{-}for\text{-}dev} \\
&\longrightarrow \text{in-dev} \longrightarrow \mathbf{ready\text{-}for\text{-}review} \\
&\longrightarrow \text{in-review} \longrightarrow \mathbf{ready\text{-}for\text{-}triage} \\
&\longrightarrow \text{in-triage} \longrightarrow 
\begin{cases} 
\mathbf{done} & \text{(skor 100/100, git commit SHA tercatat)} \\
\mathbf{ready\text{-}for\text{-}patch} \longrightarrow \text{in-dev} & \text{(remediasi terarah, max 3 run)} 
\end{cases}
\end{aligned}$$

### 2. Schema Checkpoint pada `_ompimpa/status/feature-status.yaml`
Setiap cerita kini menyimpan referensi artefak dan nomor iterasi (*attempt*):
```yaml
stories:
  - id: <STORY_ID>
    title: "<Judul Story>"
    status: ready-for-patch          # Status kanonis saat ini
    run: 2                           # Iterasi / attempt running ke-N
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
        summary: "Ringkasan temuan triage"
      commit: "5783a7e"              # Terisi SHA hanya saat status done
    retries: 1
```

### 3. Logika Resumability Otonom
Runner CLI (`src/loop_runner.ts`) membaca status checkpoint:
- **`ready-for-review`**: Langsung mengeksekusi `/review`, tanpa mengulang koding.
- **`ready-for-patch`**: Melewati fase story dan ATDD; langsung mengeksekusi `/code` dengan menyuntikkan `triage_verdict.summary` sebagai *Remediation Plan*.
- **`ready-for-dev`**: Mengeksekusi `/code` implementasi awal.

### 4. Matriks Yurisdiksi Triage & Adjudication Ledger
1. **Otoritas Model (Mini Balairung Tier 2.5 - Otomatis)**:
   - Deduplikasi temuan leksikal & lokasi identik antar-reviewer.
   - Pembuktian *False-Positive* berbantu kode (disproof nyata dengan menyertakan bukti baris kode).
   - Rekonsiliasi saran refaktor antar-spesialis stack teknis.
2. **Eskalasi Wajib ke Manusia (Human-in-the-Loop)**:
   - **Pertentangan Niat (*Intent Drift*)**: Reviewer 4 Lensa BMAD menuduh AC tidak terpenuhi, padahal terjadi *intentional redesign* oleh pengembang.
   - **Ambiguitas Lingkup (*Scope Creep*)**: Usulan edge-case baru di luar batas PRD aktif (harus diputuskan: tunda ke backlog vs masukkan tiket).
   - **Pelanggaran Hukum Besi (Statutori)**: 26 Hukum Besi Elixir bersifat mutlak (*fail-closed*), dilarang di-dismiss oleh model.
   - **Circuit Breaker Terpicu**: Retries mencapai batas maksimal (`retries >= 3`).
3. **Adjudication Ledger**:
   Setiap keputusan pembatalan/penyesuaian temuan oleh model disimpan di `_ompimpa/triage/<ID>-adjudication.json` dan di-append ke seksi `## 11. Review Triage Log` pada SPEC story.

---

## 5. Enforced Invariants

* **INV-11 (Done-Git Atomicity):**  
  Fungsi `updateFeatureStatus(targetDir, storyId, "done")` WAJIB menolak menulis status `done` jika `git status --porcelain` pada target/test files mendeteksi perubahan belum ter-commit. Penulisan `done` dan Git Commit harus satu kesatuan atomik.
* **INV-12 (Adjudication Ledger & Statutory Shield):**  
  Setiap temuan yang dibatalkan oleh adjudikasi model WAJIB memiliki entri bukti di `_ompimpa/triage/<ID>-adjudication.json`. Pelanggaran aturan statutori (`01-` s.d. `26-` atau kategori `IronLaw`) DILARANG KERAS dibatalkan oleh model.

---

## 6. Consequences

### Dampak Positif:
1. **Zero Wasted Tokens**: Crash pada sesi review atau triage tidak lagi membuang puluhan ribu token untuk mengulang fase yang sudah beres.
2. **Visibilitas Akurat**: TUI Monitor dan CLI status dapat membedakan cerita yang sedang koding awal vs cerita yang sedang dalam fase perbaikan (*patching*).
3. **Repository Bersih**: Menghilangkan 100% insiden working tree kotor yang tertinggal saat transisi antar-story.
4. **Audit Trail Jelas**: Developer manusia dapat meninjau seluruh keputusan AI yang mengabaikan temuan audit di seksi Adjudication Ledger.

### Trade-offs & Mitigasi:
* *Ukuran Berkas YAML*: Penambahan blok `checkpoint:` menambah ukuran `feature-status.yaml`. Dimitigasi dengan pembatasan array ringkas (hanya berkas kunci dan ringkasan teks pendek).

---

*Disusun oleh H. Agus Salim (`ompimpa-prd`) & disahkan oleh Dewan Balairung Sari — MADR 3.0+*
