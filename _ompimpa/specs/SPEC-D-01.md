---
title: 'D-01 - Story JIT Spec Generator (/ompimpa:story)'
type: 'feature'
created: '2026-09-03'
status: 'ready-for-atdd'
route: 'dispatch'
review_loop_iteration: 0
spec: '_ompimpa/specs/SPEC-D-01.md'
prd: '_ompimpa/prd/PRD-002-dekomposisi-fase-outer-loop-inspect.md'
adr: '_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md'
---

# SPEC-D-01: Story JIT Spec Generator (/ompimpa:story)

> **Status:** Ready for ATDD (TEA-01) — story file tunggal (pengganti format story terpisah; lihat `commands/story.md`)
> **Epic:** EPIC-D — Outer Loop Driver & Command Modularization — Dekomposisi Fase & Eksekusi Otonom  
> **Story ID:** `D-01`  
> **Priority:** `P0` | **TEA Tier:** `P0` | **Estimate:** `S`  
> **Scoring Impact:** `TEA-01, TEA-16`  
> **Author / Architect:** H. Agus Salim (`ompimpa-prd`) — Tata Kelola OMP-IMPA  
> **Tanggal Terbit:** 2026-09-03  
> **Rujukan Tata Kelola:**
> - **PRD:** [`PRD-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, & Unifikasi Master Diagnostic /inspect`](_ompimpa/prd/PRD-002-dekomposisi-fase-outer-loop-inspect.md)
> - **ADR:** [`ADR-002: Dekomposisi Fase Rekayasa, Outer Loop Driver, 10 Isolated Reviewers Sejati, & Unifikasi Master Diagnostic /inspect`](_ompimpa/adr/ADR-002-dekomposisi-fase-outer-loop-inspect.md)
> - **Backlog DAG:** `_ompimpa/stories.yaml` (Story `D-01`)

---

<frozen-after-approval reason="human-owned intent — dilarang diubah agen/dev/review kecuali manusia menegosiasi ulang">

## Intent

**Problem:** Implementasikan generator spesifikasi mikro just-in-time _ompimpa/specs/SPEC-[ID].md

**Approach:** Implementasikan kontrak §3–§5 di berkas target §6 hingga seluruh AC §2 hijau.

## Boundaries & Constraints

**Always:** Patuhi 26 Hukum Besi Elixir; 100% AC §2 terikat asersi tes (TEA-01); scoped-test selama /code.

**Never:** Di luar target files §6; ubah intent beku ini; tandai done sebelum /triage 100/100.

</frozen-after-approval>

---

## 0. Open Questions (Gerbang Siap-Kembang)

_Tidak ada pertanyaan terbuka. SPEC dilarang berstatus siap-dev selama seksi ini terisi: setiap jawaban manusia wajib dicatat ke blok frozen di atas lalu entrinya dihapus._

---

## 1. Ringkasan Cerita (Story Overview)

Implementasikan generator spesifikasi mikro just-in-time _ompimpa/specs/SPEC-[ID].md
sesaat sebelum koding/ATDD, memuat Gherkin presisi, signature fungsi, dan lazy xref blast-radius.

### Ketergantungan DAG (Dependencies)
- **Depends On:** `A-02`
- **Target Files Terdaftar:** `commands/story.md # baru`, `_ompimpa/specs/`, `src/story_spec.ts # generator logic`, `test/story_spec.test.ts # unit tests`

---

## 2. Skenario Gherkin Presisi (ATDD Ready — TEA-01)

Skenario berikut siap di-scaffold oleh Tuanku Imam Bonjol (`/atdd D-01`) menjadi asersi uji merah (*Red-Phase*):

```gherkin
Feature: D-01 - Story JIT Spec Generator (/ompimpa:story)
  Sebagai pengembang sistem OMP-IMPA
  Saya ingin Story JIT Spec Generator (/ompimpa:story)
  Agar mematuhi target mutu arsitektur TEA-01, TEA-16 dan spesifikasi produk

  @ac-d01-1 @tea-01
  Scenario: AC-D01-1 - ompimpa story <ID> dijalankan
    Given story ID valid di stories.yaml
    When ompimpa story <ID> dijalankan
    Then file _ompimpa/specs/SPEC-[ID].md terbit dengan Gherkin dan signature fungsi
```

---

## 3. Tanda Tangan Fungsi & Kontrak Antarmuka (*Function Signatures & Typespecs*)

Berikut kontrak pasti (*exact signatures, typespecs, & arity*) yang wajib dipenuhi oleh kode produksi:

#### `generateStorySpec/2`
```typescript
/** Menghasilkan dokumen spesifikasi mikro just-in-time _ompimpa/specs/SPEC-[ID].md secara deterministik. */
generateStorySpec(storyId: string, options?: StorySpecOptions): Promise<StorySpecResult>
```

#### `loadStoryDetail/2`
```typescript
/** Membaca dan memvalidasi entri story dari _ompimpa/stories.yaml. */
loadStoryDetail(storyId: string, repoRoot?: string): Promise<{ story: StoryDetail; epic?: EpicDetail }>
```

#### `getBlastRadiusForStory/2`
```typescript
/** Menganalisis blast-radius file yang terdampak via lazy mix xref callers. */
getBlastRadiusForStory(story: StoryDetail, repoRoot?: string): Promise<BlastRadiusContext>
```

---

## 4. Skema Data & Konfigurasi Ecto / Ash Resource

> Story ini bertipe stateless/tooling/file-backed; tidak memerlukan skema basis data atau migrasi Ecto/Ash.


---

## 5. Analisis Dampak & Blast-Radius (*Lazy mix xref*)

- **Menyentuh Core Context:** `Tidak`
- **Metode Pemindaian:** `leaf_isolated`
- **Ringkasan Dampak:** Modul perifer/tooling terisolasi — tidak menyentuh core context atau skema database inti.
- **Modul / Callers Terdampak:**
  - _Tidak ada pemanggil eksternal terdampak (modul perifer atau leaf)._

---

## 6. Berkas Target Implementasi & Berkas Tes (*Target Files & Test Files*)

### Berkas Implementasi Produksi
- `commands/story.md`
- `_ompimpa/specs/`
- `src/story_spec.ts`

### Berkas Uji ATDD (*Red-Phase Targets*)
- `test/story_spec.test.ts`

---

## 6b. Tasks & Acceptance (Satu Tugas per Berkas)

**Execution:**
- [ ] `commands/story.md` -- implementasikan sesuai kontrak §3 dan skenario §2; tandai [x] saat AC terkait hijau
- [ ] `_ompimpa/specs/` -- implementasikan sesuai kontrak §3 dan skenario §2; tandai [x] saat AC terkait hijau
- [ ] `src/story_spec.ts` -- implementasikan sesuai kontrak §3 dan skenario §2; tandai [x] saat AC terkait hijau

**Acceptance Criteria (ringkas — normatif penuh di §2):**
- AC-D01-1: Given story ID valid di stories.yaml → Then file _ompimpa/specs/SPEC-[ID].md terbit dengan Gherkin dan signature fungsi

---

## 6c. Code Map (Hasil Investigasi — Agen Implementasi Dilarang Mencari Ulang)

- _Tidak ada pemanggil eksternal (leaf_isolated)._

---

## 7. Batas Penghentian & Gerbang Kualitas (*Kill Criteria & Quality Gates*)

- **Kill Criteria:**
  - _Tidak ada kill criteria spesifik (mengikuti aturan umum timeout 60s per reviewer)._
- **In-Band TEA Compliance:**
  - **TEA-01 Traceability:** 100% Kriteria Penerimaan Gherkin di atas wajib terikat pada asersi tes.
  - **Flaky & Latency Guard:** Dilarang menggunakan `Process.sleep` dan waktu eksekusi unit test wajib < 50ms.
  - **Mutation Guard:** Dilarang menggunakan asersi longgar/formalitas demi mencegah *false greens*.
- **Ambang Lolos Scorecard:** Wajib mencapai skor **100/100 PASS** pada evaluasi `/triage D-01`.

---

## 8. Verification (Perintah Pengecekan Mandiri Agen)

- `bun test test/story_spec.test.ts` -- expected: seluruh asersi ATDD hijau

---

## 9. Implementation Notes (Append-Only Selama /code)

_Kosong saat planning. Catat keputusan, berkas tersentuh, dan kejutan di sini; dilarang menghapus seksi ini._

---

## 10. Spec Change Log (Append-Only Saat Loopback bad_spec)

_Kosong hingga loopback review pertama. Setiap entri: temuan pemicu → amendemen → known-bad yang dihindari → instruksi KEEP._

---

## 11. Review Triage Log (Satu Baris per Temuan Review)

_Kosong hingga review pertama. Setiap temuan: verdict (high/medium/low/false/maybe-false) + bukti satu-dua kalimat; dilarang drop/merge diam-diam._
