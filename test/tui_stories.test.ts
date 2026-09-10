import { describe, it, expect } from "bun:test";
import {
  renderStoriesTable,
  renderStoryCard,
  type RenderStoriesOptions,
} from "../src/tui/panes/stories";
import type { StoryStatusItem } from "../src/tui/data";
import { stripAnsi, visibleLength } from "../src/tui/terminal";

describe("F-03: Story Kanban & Active Contract Inspector Pane", () => {
  const sampleStories: StoryStatusItem[] = [
    {
      id: "19-1",
      title: "Fondasi Borgol Linter",
      epic: "epic-19",
      status: "done",
      tea_tier: "P0",
      priority: "P0",
      retries: 0,
    },
    {
      id: "19-2",
      title: "Refactoring Transaksi Inti",
      epic: "epic-19",
      status: "in-progress",
      tea_tier: "P0",
      priority: "P0",
      retries: 1,
    },
    {
      id: "19-3",
      title: "Modul Kas dan Bank",
      epic: "epic-19",
      status: "backlog",
      tea_tier: "P1",
      priority: "P1",
      retries: 0,
    },
    {
      id: "19-4",
      title: "Gagal Uji Mutu",
      epic: "epic-19",
      status: "failed",
      tea_tier: "P0",
      priority: "P0",
      retries: 3,
    },
  ];

  describe("AC-F03-1: Kanban Status Glyph Mapping", () => {
    it("merender glif status kanban yang tepat untuk setiap status cerita", () => {
      const options: RenderStoriesOptions = {
        stories: sampleStories,
        selectedIndex: 0,
        width: 32,
        height: 10,
      };

      const lines = renderStoriesTable(options);
      expect(lines.length).toBeGreaterThanOrEqual(4);

      const text = lines.map((l) => stripAnsi(l)).join("\n");

      // Verifikasi glif untuk masing-masing status
      // done -> ✔
      expect(text).toMatch(/✔\s+19-1/);
      // in-progress -> ▶
      expect(text).toMatch(/▶\s+19-2/);
      // backlog -> ⏳
      expect(text).toMatch(/⏳\s+19-3/);
      // failed -> ✖
      expect(text).toMatch(/✖\s+19-4/);

      // Setiap baris tidak boleh melebihi lebar visual width
      for (const line of lines) {
        expect(visibleLength(line)).toBeLessThanOrEqual(32);
      }
    });
  });

  describe("AC-F03-2: Story Selection Indicator & Auto-Focus", () => {
    it("menampilkan indikator kursor '>' atau highlight pada cerita yang dipilih", () => {
      const options: RenderStoriesOptions = {
        stories: sampleStories,
        selectedIndex: 1, // pilih 19-2
        width: 32,
        height: 10,
      };

      const lines = renderStoriesTable(options);
      const cleanLines = lines.map((l) => stripAnsi(l));

      // Baris pertama (19-1) tidak boleh memiliki indikator aktif '>'
      expect(cleanLines[0]).not.toMatch(/^>/);

      // Baris kedua (19-2) yang dipilih harus memiliki indikator kursor '>'
      expect(cleanLines[1]).toMatch(/^>\s*/);
    });
  });

  describe("AC-F03-3: Active Contract Detail Card Rendering", () => {
    it("merender kartu kontrak dengan judul, target files, dan checklist AC Gherkin", () => {
      const specMarkdown = `
# SPEC-19-2: Refactoring Modul Transaksi Akuntansi Inti

## Intent
**Problem:** Menghapus modal legacy dan beralih ke halaman penuh.

## 2. Kriteria Penerimaan (Acceptance Criteria)
### AC-192-1: Form Workspace Tanpa Modal
- Given pengguna masuk ke jurnal baru
- When form dimuat
- Then menampilkan FormWorkspace tanpa elemen modal

### AC-192-2: Nomor Otomatis Baca-Saja
- Given autoname aktif
- When membuka halaman
- Then nomor berstatus baca-saja
`;

      const options: RenderCardOptions = {
        story: sampleStories[1], // 19-2
        specMarkdown,
        width: 60,
        height: 15,
      };

      const cardLines = renderStoryCard(options);
      expect(cardLines.length).toBeGreaterThan(0);

      const cardText = cardLines.map((l) => stripAnsi(l)).join("\n");

      expect(cardText).toContain("19-2");
      expect(cardText).toContain("Refactoring Transaksi Inti");
      expect(cardText).toContain("P0");
      expect(cardText).toContain("AC-192-1");
      expect(cardText).toContain("AC-192-2");

      for (const line of cardLines) {
        expect(visibleLength(line)).toBeLessThanOrEqual(60);
      }
    });
  });

  describe("AC-F03-4: Graceful Fallback on Missing Spec", () => {
    it("menampilkan kartu ringkasan tanpa error saat specMarkdown bernilai undefined/kosong", () => {
      const options: RenderCardOptions = {
        story: sampleStories[2], // 19-3 (backlog)
        specMarkdown: undefined,
        width: 50,
        height: 8,
      };

      const cardLines = renderStoryCard(options);
      expect(cardLines.length).toBeGreaterThan(0);

      const cardText = cardLines.map((l) => stripAnsi(l)).join("\n");
      expect(cardText).toContain("19-3");
      expect(cardText).toContain("Modul Kas dan Bank");
      expect(cardText).toContain("P1");
      expect(cardText).toContain("Spesifikasi mikro belum dibuat");
    });
  });
});
