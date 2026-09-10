import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  TuiController,
  resolveTuiTargetDir,
  type TuiOptions,
} from "../src/tui/index";

describe("F-05: CLI Subcommand Integration, Keyboard Navigation & Lifecycle Hygiene", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-tui-ctrl-test-"));
    const ompimpaDir = path.join(tempDir, "_ompimpa");
    const statusDir = path.join(ompimpaDir, "status");
    await fs.mkdir(statusDir, { recursive: true });

    // Fixtures
    const featureStatusYaml = `
stories:
  - id: 19-1
    title: "First story"
    status: done
    retries: 0
    epic: epic-19
  - id: 19-2
    title: "Second story"
    status: in-progress
    retries: 0
    epic: epic-19
  - id: 19-3
    title: "Third story"
    status: backlog
    retries: 0
    epic: epic-19
`;
    await fs.writeFile(path.join(statusDir, "feature-status.yaml"), featureStatusYaml, "utf-8");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("AC-F05-1: Keyboard Navigation State Transitions", () => {
    it("memindahkan indeks seleksi cerita ke atas atau bawah saat tombol panah ditekan", async () => {
      const controller = new TuiController({ targetDir: tempDir });
      await controller.refreshState();

      expect(controller.selectedIndex).toBe(0);

      // Down arrow -> index 1
      controller.handleInput("\x1b[B"); // Down arrow ANSI escape
      expect(controller.selectedIndex).toBe(1);

      // 'j' key -> index 2
      controller.handleInput("j");
      expect(controller.selectedIndex).toBe(2);

      // Down at bottom -> stays bounded at 2
      controller.handleInput("j");
      expect(controller.selectedIndex).toBe(2);

      // Up arrow -> index 1
      controller.handleInput("\x1b[A"); // Up arrow ANSI escape
      expect(controller.selectedIndex).toBe(1);

      // 'k' key -> index 0
      controller.handleInput("k");
      expect(controller.selectedIndex).toBe(0);

      // Up at top -> stays bounded at 0
      controller.handleInput("k");
      expect(controller.selectedIndex).toBe(0);
    });
  });

  describe("AC-F05-2: Cyclical Tab Switching via Tab Key", () => {
    it("mengganti tab aktif secara siklikal saat tombol Tab ditekan", () => {
      const controller = new TuiController({ targetDir: tempDir });
      expect(controller.activeTab).toBe("activity");

      controller.handleInput("\t"); // Tab key
      expect(controller.activeTab).toBe("test_logs");

      controller.handleInput("\t"); // Tab key
      expect(controller.activeTab).toBe("spec");

      controller.handleInput("\t"); // Tab key
      expect(controller.activeTab).toBe("activity");
    });

    it("mengganti status showThinking saat tombol 't' ditekan", () => {
      const controller = new TuiController({ targetDir: tempDir });
      expect(controller.showThinking).toBe(false);

      controller.handleInput("t");
      expect(controller.showThinking).toBe(true);

      controller.handleInput("t");
      expect(controller.showThinking).toBe(false);
    });
  });

  describe("AC-F05-3: Terminal Restoration & Hygiene Guarantee", () => {
    it("mengekstrak instruksi pembersihan terminal yang memulihkan kursor dan alternate buffer", () => {
      const controller = new TuiController({ targetDir: tempDir });

      const cleanupSequence = controller.getCleanupSequence();
      // Must include show cursor (\x1b[?25h) and restore main screen buffer (\x1b[?1049l)
      expect(cleanupSequence).toContain("\x1b[?25h");
      expect(cleanupSequence).toContain("\x1b[?1049l");
    });

    it("menghentikan event loop saat tombol 'q' ditekan", () => {
      const controller = new TuiController({ targetDir: tempDir });
      controller.running = true;

      controller.handleInput("q");
      expect(controller.running).toBe(false);
    });

    it("mencegah flicker periodik dengan melewatkan redraw jika frame tidak berubah (double buffering)", () => {
      const controller = new TuiController({ targetDir: tempDir });
      // First draw -> returns true (initial paint)
      const painted1 = controller.draw();
      expect(painted1).toBe(true);

      // Second draw with identical state -> returns false (skip write to stdout to prevent flicker)
      const painted2 = controller.draw();
      expect(painted2).toBe(false);

      // Force draw -> returns true
      const painted3 = controller.draw(true);
      expect(painted3).toBe(true);
  });
    });

    it("menghasilkan jumlah baris frame persis sama dengan rows tanpa baris kosong di bawah", () => {
      const controller = new TuiController({ targetDir: tempDir });
      process.stdout.columns = 100;
      process.stdout.rows = 30;

      const frame = controller.render();
      const lines = frame.split("\n");
      expect(lines.length).toBe(30);
      // Baris pertama adalah HeaderBox
      expect(lines[0]).toContain("OMP-IMPA Monitor");
      // Baris terakhir adalah footer shortcuts
      expect(lines[29]).toContain("[q] Keluar");
    });

    it("menampilkan pesan peringatan anggun saat dimensi terminal di bawah 70x20 (NFR-05)", () => {
      const controller = new TuiController({ targetDir: tempDir });
      process.stdout.columns = 65;
      process.stdout.rows = 15;

      const frame = controller.render();
      expect(frame).toContain("Terminal terlalu kecil");
      expect(frame).toContain("Minimal 70x20");
    });
  describe("AC-F05-4: CLI Target Discovery & Launch", () => {
    it("menemukan target direktori valid yang memuat _ompimpa/", () => {
      const resolved = resolveTuiTargetDir(tempDir);
      expect(resolved).toBe(tempDir);
    });

    it("melempar galat deskriptif jika direktori tidak memuat _ompimpa/", async () => {
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "empty-test-"));
      try {
        expect(() => resolveTuiTargetDir(emptyDir)).toThrow(/_ompimpa/);
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });
  });
});
