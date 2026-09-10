import { describe, it, expect } from "bun:test";
import {
  extractInventorySection,
  parseMarkdownTables,
  validateBalairungInventory,
  checkPrdCoverage,
} from "../src/inventory";

const GOOD_RISALAH = `# Risalah Balairung: Penertiban Antarmuka

## 1. Konteks

Memutuskan migrasi seluruh formulir transaksi.

## 2. Tabel Inventaris Modul & Rute

| Modul | Rute Index | Rute Baru | Rute Ubah | Komponen Wajib |
|---|---|---|---|---|
| Jurnal | /jurnal | /jurnal/baru | /jurnal/:id/ubah | form_workspace |
| Faktur | /faktur | /faktur/baru | /faktur/:id/ubah | form_workspace |

## 3. Kill Criteria

Zero modal.
`;

describe("Gerbang Inventaris Balairung → PRD", () => {
  it("extractInventorySection mengambil seksi hingga heading setara", () => {
    const section = extractInventorySection(GOOD_RISALAH);
    expect(section).not.toBeNull();
    expect(section!).toContain("Tabel Inventaris");
    expect(section!).toContain("| Jurnal |");
    expect(section!).not.toContain("Kill Criteria");
  });

  it("validateBalairungInventory lolos untuk tabel lengkap", () => {
    const res = validateBalairungInventory(GOOD_RISALAH);
    expect(res.ok).toBeTrue();
    expect(res.errors).toEqual([]);
    expect(res.rows.length).toBe(2);
    expect(res.rows[0].modul).toBe("Jurnal");
    expect(res.rows[0].newRoute).toBe("/jurnal/baru");
  });

  it("validateBalairungInventory menolak risalah tanpa seksi Inventaris (sapu-jagat)", () => {
    const res = validateBalairungInventory("# Risalah\n\nDiputuskan seluruh formulir 100% tanpa daftar.\n");
    expect(res.ok).toBeFalse();
    expect(res.errors.join(" ")).toContain("Inventaris");
  });

  it("validateBalairungInventory menolak tabel tanpa kolom rute/berkas", () => {
    const md = "# R\n\n## Inventaris\n\n| Modul | Catatan |\n|---|---|\n| Jurnal | penting |\n";
    const res = validateBalairungInventory(md);
    expect(res.ok).toBeFalse();
    expect(res.errors.join(" ")).toContain("rute/berkas");
  });

  it("validateBalairungInventory menolak baris modul kosong", () => {
    const md = "# R\n\n## Inventaris\n\n| Modul | Rute |\n|---|---|\n|  | /x |\n";
    const res = validateBalairungInventory(md);
    expect(res.ok).toBeFalse();
    expect(res.errors.join(" ")).toContain("kolom modul");
  });

  it("checkPrdCoverage mendeteksi scope-truncation (modul hilang dari PRD)", () => {
    const res = validateBalairungInventory(GOOD_RISALAH);
    const prd = "# PRD-002\n\nHanya mencakup modul Jurnal di /jurnal.\n";
    const cov = checkPrdCoverage(res.rows, prd);
    expect(cov.ok).toBeFalse();
    expect(cov.missing).toEqual(["Faktur"]);
    expect(cov.covered).toEqual(["Jurnal"]);
  });

  it("checkPrdCoverage lolos bila semua modul disebut (termasuk via stories.yaml)", () => {
    const res = validateBalairungInventory(GOOD_RISALAH);
    const cov = checkPrdCoverage(res.rows, "# PRD\n\nModul Jurnal.", "target_files: [/faktur/baru]");
    expect(cov.ok).toBeTrue();
  });

  it("parseMarkdownTables mengabaikan baris tanpa pipa", () => {
    const tables = parseMarkdownTables("teks biasa\ntanpa tabel\n");
    expect(tables).toEqual([]);
  });
});
