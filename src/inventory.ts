/**
 * Gerbang Inventaris Balairung → PRD (anti sapu-jagat, anti scope-truncation).
 *
 * Masalah yang dipecahkan (forensik sesi mimar 01a07e9a):
 * Balairung memutuskan "seluruh formulir 100%" tanpa tabel inventaris rute/berkas,
 * ADR menyalin retorika itu, PRD memangkas 24 modul → 3 modul tanpa catatan.
 * Agen dev tidak pernah menerima checklist berbasis berkas nyata.
 *
 * Gerbang mekanis:
 * 1. Risalah BALAIRUNG-*.md wajib memuat seksi "Inventaris" berisi tabel markdown
 *    dengan kolom modul + kolom rute/berkas. Tanpa ini → sidang belum boleh diketuk.
 * 2. PRD (+ stories.yaml opsional) wajib mencakup setiap modul inventaris.
 *    Modul hilang tanpa Scope Deferral Record → FAIL.
 */

export interface InventoryRow {
  modul: string;
  indexRoute: string;
  newRoute: string;
  editRoute: string;
  komponen: string;
}

export interface InventoryValidation {
  ok: boolean;
  errors: string[];
  rows: InventoryRow[];
}

export interface CoverageResult {
  ok: boolean;
  missing: string[];
  covered: string[];
}

function splitPipeRow(line: string): string[] {
  const t = line.trim();
  const inner = t.startsWith("|") && t.endsWith("|") ? t.slice(1, -1) : t;
  return inner.split("|").map((c) => c.trim());
}

function isDelimiterRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

/** Ambil seksi Inventaris (dari heading ...inventaris... hingga heading setara/lebih tinggi). */
export function extractInventorySection(markdown: string): string | null {
  const lines = markdown.split("\n");
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (m && /inventaris/i.test(m[2])) {
      start = i;
      level = m[1].length;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** Parse semua tabel pipe dalam teks → daftar {headers, rows}. */
export function parseMarkdownTables(text: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (lines[i].includes("|") && i + 1 < lines.length && isDelimiterRow(splitPipeRow(lines[i + 1]))) {
      const headers = splitPipeRow(lines[i]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|")) {
        const cells = splitPipeRow(lines[i]);
        if (cells.some((c) => c !== "")) rows.push(cells);
        i++;
      }
      tables.push({ headers, rows });
    } else {
      i++;
    }
  }
  return tables;
}

function columnIndex(headers: string[], wants: string[]): number {
  const norms = headers.map(normHeader);
  for (const w of wants) {
    const idx = norms.findIndex((h) => h.includes(w));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Validasi gerbang inventaris atas isi risalah Balairung.
 * Syarat lolos: ada seksi Inventaris + ada tabel + kolom modul +
 * kolom rute/berkas + ≥1 baris data + tiap baris punya nama modul.
 */
export function validateBalairungInventory(markdown: string): InventoryValidation {
  const errors: string[] = [];
  const section = extractInventorySection(markdown);
  if (!section) {
    return {
      ok: false,
      errors: ["Risalah tidak memuat seksi 'Inventaris': tutup sidang ditolak sebelum tabel modul/rute ditulis."],
      rows: [],
    };
  }
  const tables = parseMarkdownTables(section);
  if (tables.length === 0) {
    return {
      ok: false,
      errors: ["Seksi Inventaris tidak memuat tabel markdown: tulis tabel modul × rute × komponen."],
      rows: [],
    };
  }
  const table = tables[0];
  const modulIdx = columnIndex(table.headers, ["modul", "module", "formulir", "form", "fitur"]);
  if (modulIdx === -1) {
    errors.push(
      `Kolom modul tidak ditemukan (header: ${table.headers.join(" | ")}). Wajib ada kolom modul/formulir.`
    );
  }
  const routeIdx = columnIndex(table.headers, ["rute", "route", "berkas", "file", "path", "url"]);
  if (routeIdx === -1) {
    errors.push(
      `Kolom rute/berkas tidak ditemukan (header: ${table.headers.join(" | ")}). Wajib ada kolom rute atau berkas.`
    );
  }
  const rows: InventoryRow[] = [];
  table.rows.forEach((cells, n) => {
    const modul = modulIdx !== -1 ? (cells[modulIdx] || "") : "";
    if (!modul) {
      errors.push(`Baris data ${n + 1} tabel Inventaris kosong pada kolom modul.`);
      return;
    }
    const at = (idx: number) => (idx !== -1 ? cells[idx] || "" : "");
    rows.push({
      modul,
      indexRoute: at(columnIndex(table.headers, ["index", "daftar", "list"])),
      newRoute: at(columnIndex(table.headers, ["baru", "new", "tambah", "create"])),
      editRoute: at(columnIndex(table.headers, ["ubah", "edit", "update"])),
      komponen: at(columnIndex(table.headers, ["komponen", "component", "pola", "wajib"])),
    });
  });
  if (rows.length === 0 && errors.length === 0) {
    errors.push("Tabel Inventaris tidak memiliki baris data: daftarkan minimal 1 modul nyata.");
  }
  return { ok: errors.length === 0, errors, rows };
}

/**
 * Cek cakupan: setiap modul inventaris wajib disebut di PRD
 * (nama modul atau salah satu rutenya). Haystack tambahan opsional:
 * isi stories.yaml agar modul yang dipecah ke story tetap terhitung tercakup.
 */
export function checkPrdCoverage(rows: InventoryRow[], prdContent: string, extraHaystack = ""): CoverageResult {
  const hay = `${prdContent}\n${extraHaystack}`.toLowerCase();
  const missing: string[] = [];
  const covered: string[] = [];
  for (const row of rows) {
    const candidates = [row.modul, row.indexRoute, row.newRoute, row.editRoute].filter((c) => c && c !== "-");
    const hit = candidates.some((c) => c.length >= 3 && hay.includes(c.toLowerCase()));
    if (hit) covered.push(row.modul);
    else missing.push(row.modul);
  }
  return { ok: missing.length === 0, missing, covered };
}
