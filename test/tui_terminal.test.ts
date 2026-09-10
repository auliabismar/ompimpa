import { describe, it, expect } from "bun:test";
import {
  stripAnsi,
  visibleLength,
  truncateAnsi,
  padAnsi,
  renderBox,
  renderSplitPane,
  calculateLayout,
  type LayoutGeometry,
} from "../src/tui/terminal";

describe("F-02: ANSI Terminal Box & Layout Engine", () => {
  describe("AC-F02-1: ANSI Stripping & Visible Length Calculation", () => {
    it("menghapus kode ANSI dan menghitung panjang visual karakter secara akurat", () => {
      const coloredText = "\x1b[32;1mBerhasil\x1b[0m";
      const clean = stripAnsi(coloredText);
      expect(clean).toBe("Berhasil");
      expect(visibleLength(coloredText)).toBe(8);

      const complex = "\x1b[38;5;214m⚡ [BASH]\x1b[0m \x1b[1mmix compile\x1b[0m";
      expect(stripAnsi(complex)).toBe("⚡ [BASH] mix compile");
      // ⚡ is 2 columns visual width in terminal + 1 space + 7 [BASH] + 1 space + 11 mix compile = 21 visual cols
      expect(visibleLength(complex)).toBe(21);
    });

    it("menghitung lebar visual 2-kolom untuk emoji terminal dan simbol SMP", () => {
      expect(visibleLength("⏳")).toBe(2);
      expect(visibleLength("⌛")).toBe(2);
      expect(visibleLength("📋 Kanban")).toBe(9);
      expect(visibleLength("🎯 Detail Kontrak")).toBe(17);
      expect(visibleLength("💭 THINK:")).toBe(9);
      expect(visibleLength("📖 READ")).toBe(7);
      expect(visibleLength("📝 WRITE")).toBe(8);
      expect(visibleLength("✔")).toBe(1);
      expect(visibleLength("▶")).toBe(1);
      expect(visibleLength("✖")).toBe(1);
      expect(visibleLength("↳")).toBe(1);
    });
  });

  describe("AC-F02-2: Safe ANSI Truncation with Color Reset", () => {
    it("memotong teks panjang di batas visual yang tepat dan selalu menyisipkan reset \\x1b[0m", () => {
      const text = "\x1b[34mPanjangSekaliTeksIniHinggaMelebihiBatas\x1b[0m";
      const truncated = truncateAnsi(text, 10);

      expect(visibleLength(truncated)).toBeLessThanOrEqual(10);
      expect(truncated.endsWith("\x1b[0m")).toBe(true);
      expect(stripAnsi(truncated)).toContain("…");
    });

    it("tidak memotong teks jika panjang visual kurang dari atau sama dengan maxWidth", () => {
      const text = "\x1b[32mPendek\x1b[0m";
      const truncated = truncateAnsi(text, 10);
      expect(stripAnsi(truncated)).toBe("Pendek");
      expect(truncated).toBe(text);
    });

    it("melakukan padding teks ANSI secara rata kiri, kanan, atau tengah", () => {
      const text = "\x1b[31mError\x1b[0m";
      const paddedLeft = padAnsi(text, 10, "left");
      expect(visibleLength(paddedLeft)).toBe(10);
      expect(stripAnsi(paddedLeft)).toBe("Error     ");

      const paddedRight = padAnsi(text, 10, "right");
      expect(visibleLength(paddedRight)).toBe(10);
      expect(stripAnsi(paddedRight)).toBe("     Error");

      const paddedCenter = padAnsi(text, 11, "center");
      expect(visibleLength(paddedCenter)).toBe(11);
      expect(stripAnsi(paddedCenter)).toBe("   Error   ");
    });
  });

  describe("AC-F02-3: Precision Box Border Rendering", () => {
    it("menghasilkan bingkai kotak tertutup dengan lebar dan tinggi persis sesuai opsi", () => {
      const content = ["Baris 1", "Baris 2"];
      const width = 20;
      const height = 5;
      const box = renderBox("Judul", content, width, height);

      expect(box.length).toBe(height);
      // Setiap baris harus memiliki lebar visual persis width
      for (const line of box) {
        expect(visibleLength(line)).toBe(width);
      }

      // Baris pertama harus memuat karakter sudut Unicode dan judul
      expect(stripAnsi(box[0])).toContain("┌");
      expect(stripAnsi(box[0])).toContain("┐");
      expect(stripAnsi(box[0])).toContain("Judul");

      // Baris isi
      expect(stripAnsi(box[1])).toContain("│");
      expect(stripAnsi(box[1])).toContain("Baris 1");

      expect(stripAnsi(box[2])).toContain("│");
      expect(stripAnsi(box[2])).toContain("Baris 2");

      // Baris kosong pengisi tinggi
      expect(stripAnsi(box[3])).toContain("│");

      // Baris terakhir sudut bawah
      expect(stripAnsi(box[4])).toContain("└");
      expect(stripAnsi(box[4])).toContain("┘");
    });

    it("merender panel terpisah (renderSplitPane) dengan pembatas tengah dan border kanan tertutup", () => {
      const topLines = ["Kartu 1", "Kartu 2"];
      const bottomLines = ["Stream 1", "Stream 2", "Stream 3"];
      const width = 40;
      const totalHeight = 8;

      const pane = renderSplitPane(
        "Top Title",
        topLines,
        2,
        "Bottom Title",
        bottomLines,
        totalHeight,
        width
      );

      expect(pane.length).toBe(totalHeight);
      for (const line of pane) {
        expect(visibleLength(line)).toBe(width);
      }

      // Header atas
      expect(stripAnsi(pane[0])).toContain("┌─ Top Title");
      expect(stripAnsi(pane[0])).toContain("┐");

      // Pembatas tengah
      expect(stripAnsi(pane[3])).toContain("├─ Bottom Title");
      expect(stripAnsi(pane[3])).toContain("┤");

      // Footer bawah
      expect(stripAnsi(pane[7])).toContain("└");
      expect(stripAnsi(pane[7])).toContain("┘");

      // Garis konten harus tertutup oleh │ di kiri dan kanan
      for (let i = 1; i < totalHeight; i++) {
        if (i !== 3 && i !== 7) {
          const clean = stripAnsi(pane[i]);
          expect(clean.startsWith("│")).toBe(true);
          expect(clean.endsWith("│")).toBe(true);
        }
      }
    });
  });

  describe("AC-F02-4: Responsive Split-Pane Partitioning", () => {
    it("membagi partisi geometri layout secara responsif berdasarkan dimensi terminal", () => {
      const cols = 120;
      const rows = 40;
      const layout: LayoutGeometry = calculateLayout(cols, rows);

      expect(layout.cols).toBe(cols);
      expect(layout.rows).toBe(rows);

      // Header di paling atas
      expect(layout.header.y).toBe(0);
      expect(layout.header.height).toBe(3);
      expect(layout.header.width).toBe(cols);

      // Footer di paling bawah (1 baris agar tidak ada line kosong di bawah)
      expect(layout.footer.y).toBe(rows - 1);
      expect(layout.footer.height).toBe(1);
      expect(layout.footer.width).toBe(cols);

      // Sidebar kiri & Main kanan mengisi ruang tengah
      const middleHeight = rows - layout.header.height - layout.footer.height;
      expect(layout.sidebar.height).toBe(middleHeight);
      expect(layout.main.height).toBe(middleHeight);
      expect(layout.sidebar.x).toBe(0);
      expect(layout.sidebar.y).toBe(layout.header.height);

      expect(layout.main.x).toBe(layout.sidebar.width);
      expect(layout.main.y).toBe(layout.header.height);
      expect(layout.sidebar.width + layout.main.width).toBe(cols);

      // Sidebar lebar minimal 28, maksimal 36
      expect(layout.sidebar.width).toBeGreaterThanOrEqual(28);
      expect(layout.sidebar.width).toBeLessThanOrEqual(36);
    });

    it("mempertahankan batas minimum saat dimensi terminal mengecil", () => {
      const layout = calculateLayout(70, 20);
      expect(layout.sidebar.width).toBeGreaterThanOrEqual(20);
      expect(layout.main.width).toBeGreaterThanOrEqual(30);
    });
  });
});
