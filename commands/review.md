---
description: Menjalankan audit paralel 10 subagent terisolasi sejati (4 BMAD Spec Lens + 6 phxagents Tech Panel) via task batch tanpa inline mocking
---

# Command: /ompimpa:review (Fase 4: 10 Isolated Reviewers Panel)

Menjalankan audit kode menyeluruh dan independen menggunakan **10 Subagent Terisolasi Sejati** yang memadukan **4 Lensa Spesifikasi BMAD** dan **6 Panel Kepatuhan Teknis phxagents**:

$$\text{Panel 10} = \underbrace{\text{4 BMAD Spec Lenses}}_{\text{Fungsional \& Integritas Kontrak}} + \underbrace{\text{6 phxagents Tech Panel}}_{\text{Kepatuhan Platform \& Keamanan}}$$

> 🛡️ **Invarian INV-01 Reinforced (Anti-Inline Review — ADR-001 & ADR-002):**  
> Evaluasi kualitas pada fase review WAJIB di-dispatch melalui batch tool `task` dengan mode terisolasi (`isolated: true`) ke 10 subagent independen.  
> Dilarang keras melakukan mocking scanner regex inline di thread utama atau menimpa temuan subagent nyata demi mencegah bias konfirmasi.

---

## Panel 10 Reviewer Terisolasi

### A. 4 Lensa Spesifikasi BMAD (*Functional & Spec Governance*)
1. **`bmad_adversarial` (Tan Malaka — *Adversarial Thinker*):**  
   Mengaudit skenario ekstrem, *edge cases*, *crash/race conditions*, eksploitasi konkurensi BEAM, dan dialektika materialisme logika Madilog.
2. **`bmad_gap_verifier` (Gap Verifier — *Coverage Guardian*):**  
   Memvalidasi ketertelusuran 100% Kriteria Penerimaan Gherkin di `_ompimpa/specs/SPEC-[ID].md` terhadap berkas tes nyata (**TEA-01 Traceability**). Kehilangan 1 AC = High Finding (-15).
3. **`bmad_structural` (Structural Guardian — *Clean Spine Architect*):**  
   Mengaudit arsitektur batas domain (*domain boundaries*), coupling antarmuka, prinsip *Clean Architecture Spine*, dan isolasi dependensi.
4. **`bmad_completeness` (Completeness Auditor — *BMAD 4th Lens*):**  
   Mengaudit kelengkapan implementasi, sinkronisasi dokumentasi Diátaxis, dan integritas artefak pendukung sesuai standar upstream BMAD 4.

### B. 6 Panel Kepatuhan Teknis (*phxagents Technical Compliance*)
5. **`ompimpa-ironlaw` (Hj. Rasuna Said — *Hakim 26 Hukum Besi*):**  
   Memeriksa kepatuhan mutlak diff terhadap 26 Hukum Besi Elixir (larangan `:float` uang, pinning `^`, dsb).
6. **`ompimpa-security` (Bagindo Azizchan — *Benteng Pertahanan Perimeter*):**  
   Mendeteksi celah CSRF, XSS, Atom Exhaustion, IDOR, SQL injection mentah, dan audit rantai pasok dependensi Hex.
7. **`ompimpa-test` (Tuanku Imam Bonjol — *Panglima Benteng Mutu ATDD*):**  
   Menilai mutu pengujian TEA (Scorecard $\ge 90$), memburu *flaky test* (`Process.sleep`), mendeteksi asersi formalitas (*Assertion Mutation Guard*), dan isolasi sandbox.
8. **`ompimpa-verify` (Verification Runner — *Kompilator Ketat*):**  
   Memverifikasi kompilasi Elixir tanpa peringatan (`mix compile --warnings-as-errors`), kepatuhan formatter, dan linter statis.
9. **`ompimpa-ecto` / `ompimpa-ash` (Mohammad Hatta / Mr. Assaat — *Penata Integritas Data*):**  
   Memeriksa kueri anti-N+1, operator pinning `^`, constraint changeset, transaksi aman, atau kebijakan otorisasi *fail-closed* pada Ash resource.
10. **`ompimpa-liveview` / `ompimpa-oban` (Tuanku Tambusai / Djamaluddin Tamin — *Panglima Real-Time & Latar Belakang*):**  
    Memeriksa assigns memory hygiene, pemanfaatan Streams untuk kumpulan data besar (>100 baris), dan idempotensi worker background job Oban.

---

## Penggunaan

### Di Dalam Sesi OMP Harness
```bash
/ompimpa:review <STORY_ID>        # Menjalankan dispatch 10 subagent untuk Story ID
/review <STORY_ID>                # Alias singkat
/review                           # Menjalankan review pada story aktif dari status
```

---

## Pola Eksekusi Batch Tool `task` (`isolated: true`)

Eksekusi 10 subagent dipanggil secara paralel dalam satu pemanggilan batch tool `task` dengan parameter isolasi Git worktree:

```typescript
// Contoh pemanggilan batch task oleh orchestrator review
task({
  context: `
# Goal: Lakukan audit independen Story ${storyId}
# Constraints: Dilarang mengubah kode sumber; tulis laporan JSON murni ke disk.
# Spec: _ompimpa/specs/SPEC-${storyId}.md
# Output File: _ompimpa/review/${storyId}-<reviewer_id>.json
`,
  tasks: [
    // 4 BMAD Spec Lenses
    {
      name: "BmadAdversarial",
      agent: "ompimpa-triz",
      task: `Lakukan audit adversarial pada Story ${storyId}. Tulis temuan ke _ompimpa/review/${storyId}-bmad_adversarial.json`
    },
    {
      name: "BmadGapVerifier",
      agent: "scout",
      task: `Audit TEA-01 AC Gherkin vs test files untuk ${storyId}. Tulis ke _ompimpa/review/${storyId}-bmad_gap_verifier.json`
    },
    {
      name: "BmadStructural",
      agent: "scout",
      task: `Audit clean spine and domain boundaries untuk ${storyId}. Tulis ke _ompimpa/review/${storyId}-bmad_structural.json`
    },
    {
      name: "BmadCompleteness",
      agent: "scout",
      task: `Audit completeness & doc sync untuk ${storyId}. Tulis ke _ompimpa/review/${storyId}-bmad_completeness.json`
    },

    // 6 phxagents Technical Panel
    {
      name: "OmpimpaIronLaw",
      agent: "ompimpa-ironlaw",
      task: `Audit 26 Hukum Besi Elixir pada ${storyId}. Tulis temuan ke _ompimpa/review/${storyId}-ompimpa-ironlaw.json`
    },
    {
      name: "OmpimpaSecurity",
      agent: "ompimpa-security",
      task: `Audit celah keamanan perimeter dan OWASP untuk ${storyId}. Tulis ke _ompimpa/review/${storyId}-ompimpa-security.json`
    },
    {
      name: "OmpimpaTest",
      agent: "ompimpa-test",
      task: `Audit TEA scorecard mutu tes, flaky sleep, dan mutation guard. Tulis ke _ompimpa/review/${storyId}-ompimpa-test.json`
    },
    {
      name: "OmpimpaVerify",
      agent: "scout",
      task: `Verifikasi strict compiler warnings dan linters. Tulis ke _ompimpa/review/${storyId}-ompimpa-verify.json`
    },
    {
      name: "OmpimpaEcto",
      agent: "ompimpa-ecto",
      task: `Audit Ecto/Ash pinning, query efficiency, anti-N+1. Tulis ke _ompimpa/review/${storyId}-ompimpa-ecto.json`
    },
    {
      name: "OmpimpaLiveview",
      agent: "ompimpa-liveview",
      task: `Audit assigns memory hygiene, Streams, Oban idempotency. Tulis ke _ompimpa/review/${storyId}-ompimpa-liveview.json`
    }
  ]
});
```

---

## Skema Berkas Keluaran JSON (`_ompimpa/review/<STORY_ID>-<REVIEWER_ID>.json`)

Setiap subagent wajib menuliskan berkas JSON valid berupa array temuan (*array of findings*) atau array kosong `[]` jika tidak ada temuan:

```json
[
  {
    "severity": "P0",
    "file": "lib/my_app/accounts/user.ex",
    "line": 42,
    "column": 10,
    "ruleId": "01-no-float-money",
    "rule_violation": "Dilarang tipe :float untuk uang/saldo",
    "recommendation": "Gunakan tipe :decimal atau integer sen sesuai Hukum Besi #1",
    "category": "IronLaw",
    "message": "Field balance menggunakan tipe :float"
  }
]
```

---

## Alur Kerja Terpadu & Serah Terima ke `/triage`

```
[1. DISPATCH 10 SUBAGENTS] ──► Panggil batch tool task (isolated: true) untuk 10 reviewers.
                                     │
[2. AUDIT MANDIRI]         ──► Masing-masing subagent memeriksa diff / target files secara terisolasi.
                                     │
[3. TULIS JSON KE DISK]    ──► 10 berkas terbit di `_ompimpa/review/<ID>-<reviewer>.json`.
                                     │
[4. VALIDASI STRUKTUR]     ──► `dispatchIsolatedReview()` di `src/reviewer.ts` memvalidasi integritas JSON
                               (tanpa mocking inline regex prewalk).
                                     │
[5. SERAH TERIMA KE TRIAGE]──► Panggil `/triage <STORY_ID>` (`src/triage.ts`) untuk:
                               • Deduplikasi hash `file:line:ruleId`.
                               • Evaluasi penalti deterministik 35-Row Registry v2 (-30/-15/-5/-2).
                               • Penerbitan Skor Akhir (100/100 PASS) atau Remediation Plan.
```
