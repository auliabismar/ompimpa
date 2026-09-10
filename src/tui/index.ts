import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import {
  StatGatedReader,
  type KanbanState,
  type SessionEvent,
} from "./data";
import {
  calculateLayout,
  renderBox,
  renderSplitPane,
  stripAnsi,
  truncateAnsi,
  padAnsi,
  visibleLength,
} from "./terminal";
import { renderStoriesTable, renderStoryCard } from "./panes/stories";
import {
  renderStreamPane,
  renderTestLogPane,
  type StreamTab,
} from "./panes/stream";

export interface TuiOptions {
  targetDir?: string;
  fps?: number;
  showThinking?: boolean;
}

/**
 * Resolves and validates the target project directory containing _ompimpa.
 */
export function resolveTuiTargetDir(cwd: string, argDir?: string): string {
  const candidate = argDir ? path.resolve(cwd, argDir) : cwd;
  const ompimpaPath = path.join(candidate, "_ompimpa");

  if (!fs.existsSync(ompimpaPath)) {
    throw new Error(
      `Direktori '${candidate}' tidak memuat struktur '_ompimpa/'. Pastikan target direktori adalah proyek OMP-IMPA yang valid.`
    );
  }

  return candidate;
}

export class TuiController {
  public readonly targetDir: string;
  public readonly reader: StatGatedReader;
  public kanbanState: KanbanState | null = null;
  public sessionEvents: SessionEvent[] = [];
  public selectedIndex = 0;
  public activeTab: StreamTab = "activity";
  public showThinking = false;
  public running = false;
  public activeSessionFile: string | null = null;
  public lastRenderedFrame = "";

  private lastTestLogs: string[] = [];

  constructor(options: TuiOptions = {}) {
    this.targetDir = options.targetDir ? path.resolve(options.targetDir) : process.cwd();
    this.reader = new StatGatedReader(this.targetDir);
    this.showThinking = options.showThinking ?? false;
  }

  /**
   * Refreshes Kanban state, discovers active session, and tails new events.
   */
  async refreshState(): Promise<void> {
    this.kanbanState = await this.reader.loadKanbanState();

    const latestSession = await this.reader.findLatestSessionFile();
    if (latestSession && latestSession !== this.activeSessionFile) {
      this.activeSessionFile = latestSession;
      this.sessionEvents = [];
    }
    if (this.activeSessionFile) {
      const newEvents = await this.reader.tailSessionEvents(this.activeSessionFile);
      if (newEvents.length > 0) {
        this.sessionEvents.push(...newEvents);
        // Bound event buffer to 1000 items
        if (this.sessionEvents.length > 1000) {
          this.sessionEvents = this.sessionEvents.slice(this.sessionEvents.length - 1000);
        }
      }
    }

    // Refresh spec markdown for selected story if available
    const selectedStory = this.getSelectedStory();
    if (selectedStory) {
      const specPath = path.join(this.targetDir, `_ompimpa/specs/SPEC-${selectedStory.id}.md`);
      try {
        this.activeSpecMarkdown = await fsp.readFile(specPath, "utf-8");
      } catch {
        this.activeSpecMarkdown = "";
      }
    }

    // Refresh test logs
    try {
      this.lastTestLogs = await renderTestLogPane(this.targetDir, 80, 20);
    } catch {
      this.lastTestLogs = [];
    }
  }

  getSelectedStory() {
    if (!this.kanbanState || this.kanbanState.stories.length === 0) return null;
    const clampedIndex = Math.max(0, Math.min(this.selectedIndex, this.kanbanState.stories.length - 1));
    return this.kanbanState.stories[clampedIndex];
  }

  /**
   * Handles interactive raw keyboard input.
   */
  handleInput(key: string): void {
    const totalStories = this.kanbanState?.stories.length || 0;

    if (key === "q" || key === "\x03") {
      // 'q' or Ctrl+C -> Quit
      this.running = false;
      this.cleanup();
      return;
    }

    if (key === "\x1b[B" || key === "j") {
      // Down arrow / j
      if (totalStories > 0 && this.selectedIndex < totalStories - 1) {
        this.selectedIndex++;
      }
    } else if (key === "\x1b[A" || key === "k") {
      // Up arrow / k
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
      }
    } else if (key === "\t") {
      // Tab key -> cycle tabs
      if (this.activeTab === "activity") {
        this.activeTab = "test_logs";
      } else if (this.activeTab === "test_logs") {
        this.activeTab = "spec";
      } else {
        this.activeTab = "activity";
      }
    } else if (key === "t") {
      // Toggle thinking
      this.showThinking = !this.showThinking;
    } else if (key === "r") {
      // Force refresh
      void this.refreshState();
    }
  }

  getInitSequence(): string {
    return "\x1b[?1049h\x1b[?25l\x1b[?7l"; // Enter alternate screen buffer, hide cursor, disable auto-wrap (DECAWM)
  }

  getCleanupSequence(): string {
    return "\x1b[?7h\x1b[?25h\x1b[?1049l\x1b[0m"; // Restore auto-wrap, show cursor, restore main screen buffer, reset styles
  }

  cleanup(): void {
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        // Ignore errors during exit
      }
    }
    process.stdout.write(this.getCleanupSequence());
  }

  /**
   * Renders the complete dashboard view into an ANSI string.
   */
  render(): string {
    const cols = process.stdout.columns || 100;
    const rows = process.stdout.rows || 30;

    // Graceful degradation for undersized terminals (NFR-05: < 70x20)
    if (cols < 70 || rows < 20) {
      const msg = `\x1b[33;1m⚠️ Terminal terlalu kecil (${cols}x${rows}). Minimal 70x20. Perbesar jendela.\x1b[0m`;
      const centerMsg = padAnsi(truncateAnsi(msg, cols), cols, "center");
      const topPad = Math.max(0, Math.floor((rows - 1) / 2));
      const bottomPad = Math.max(0, rows - 1 - topPad);
      return `${"\n".repeat(topPad)}${centerMsg}${"\n".repeat(bottomPad)}`;
    }

    const layout = calculateLayout(cols, rows);
    const reset = "\x1b[0m";

    // 1. Header Line
    const projectName = path.basename(this.targetDir);
    const epicTitle = this.kanbanState?.epicId || "OMP-IMPA";
    const selectedStory = this.getSelectedStory();
    const activeInfo = selectedStory ? `Story: \x1b[33;1m${selectedStory.id}\x1b[0m (${selectedStory.status})` : "Idle";
    const headerTitle = ` OMP-IMPA Monitor: ${projectName} [${epicTitle}] | ${activeInfo} `;

    const headerBox = renderBox(
      headerTitle,
      [
        `Target: \x1b[90m${this.targetDir}\x1b[0m | Session: \x1b[90m${this.activeSessionFile ? path.basename(this.activeSessionFile) : "searching..."}\x1b[0m`,
      ],
      layout.header.width,
      layout.header.height,
      "\x1b[36m"
    );

    // 2. Left Sidebar (Stories Kanban)
    const storiesContent = renderStoriesTable({
      stories: this.kanbanState?.stories || [],
      selectedIndex: this.selectedIndex,
      width: layout.sidebar.width - 2,
      height: layout.sidebar.height - 2,
    });
    const sidebarBox = renderBox(
      "📋 Kanban",
      storiesContent,
      layout.sidebar.width,
      layout.sidebar.height,
      "\x1b[90m"
    );

    // 3. Right Main Pane (Unified Split Pane: Detail Kontrak on top, Stream on bottom)
    const rawCardContent = selectedStory
      ? renderStoryCard({
          story: selectedStory,
          specMarkdown: this.activeSpecMarkdown,
          width: layout.main.width - 2,
          height: 6,
        })
      : ["Tidak ada cerita terpilih"];

    const cardContent = rawCardContent.filter((l) => stripAnsi(l).trim().length > 0);
    // Dynamic card rows based on actual meaningful lines (prevents empty gap above tab!)
    const cardRows = Math.min(
      Math.max(1, cardContent.length),
      Math.max(2, Math.floor((layout.main.height - 3) * 0.35))
    );
    const streamRows = Math.max(1, layout.main.height - 3 - cardRows);

    // Tabs Header for Stream
    const tabActivityBadge = this.activeTab === "activity" ? "\x1b[1;33m[1. Live Activity]\x1b[0m" : "\x1b[90m 1. Live Activity \x1b[0m";
    const tabTestLogsBadge = this.activeTab === "test_logs" ? "\x1b[1;33m[2. Test Logs]\x1b[0m" : "\x1b[90m 2. Test Logs \x1b[0m";
    const tabSpecBadge = this.activeTab === "spec" ? "\x1b[1;33m[3. Micro Spec]\x1b[0m" : "\x1b[90m 3. Micro Spec \x1b[0m";
    const thinkingTag = this.showThinking ? "\x1b[35;1m[THINK: ON]\x1b[0m" : "\x1b[90m[THINK: off (t)]\x1b[0m";
    const streamTitle = `${tabActivityBadge} ${tabTestLogsBadge} ${tabSpecBadge} | ${thinkingTag}`;

    let streamLines: string[] = [];
    if (this.activeTab === "test_logs") {
      streamLines = this.lastTestLogs;
    } else if (this.activeTab === "spec") {
      streamLines = this.activeSpecMarkdown ? this.activeSpecMarkdown.split("\n") : ["Spesifikasi tidak tersedia."];
    } else {
      streamLines = renderStreamPane({
        events: this.sessionEvents,
        tab: "activity",
        showThinking: this.showThinking,
        targetDir: this.targetDir,
        width: layout.main.width - 2,
        height: streamRows,
      });
    }

    const rightPaneLines = renderSplitPane(
      "🎯 Detail Kontrak",
      cardContent,
      cardRows,
      streamTitle,
      streamLines,
      layout.main.height,
      layout.main.width,
      "\x1b[90m"
    );

    // Combine Columns (Sidebar on left, RightPane on right)
    const middleLines: string[] = [];
    for (let r = 0; r < layout.sidebar.height; r++) {
      const leftPart = sidebarBox[r] || " ".repeat(layout.sidebar.width);
      const rightPart = rightPaneLines[r] || " ".repeat(layout.main.width);
      middleLines.push(leftPart + rightPart);
    }
    // 4. Footer Line (safely truncated to cols - 1 to prevent hitting bottom-right cell auto-wrap)
    const footerShortcuts = " [q] Keluar  [↑/↓/j/k] Pilih Story  [Tab] Ganti Tab  [t] Toggle Thinking  [r] Refresh ";
    const safeFooter = truncateAnsi(footerShortcuts, layout.footer.width - 1);
    const footerText = padAnsi(`\x1b[90m${safeFooter}\x1b[0m`, layout.footer.width - 1, "left");

    // Return full screen frame content
    return `${headerBox.join("\n")}\n${middleLines.join("\n")}\n${footerText}${reset}`;
  }

  /**
   * Atomically draws frame to terminal only when content changes or forced.
   * Uses DEC Mode 2026 synchronized updates to prevent top-line flicker and tearing.
   */
  draw(force = false): boolean {
    const rawFrame = this.render();
    if (!force && rawFrame === this.lastRenderedFrame) {
      return false; // Skip redundant draw: zero bytes sent, zero flicker
    }
    this.lastRenderedFrame = rawFrame;
    // \x1b[?2026h = begin synchronized update
    // \x1b[H      = cursor to top-left (row 1, col 1)
    // \x1b[?2026l = end synchronized update (atomic flip)
    const atomicFrame = `\x1b[?2026h\x1b[H${rawFrame}\x1b[?2026l`;
    process.stdout.write(atomicFrame);
    return true;
  }

  /**
   * Starts the interactive event loop.
   */
  async start(): Promise<void> {
    if (!process.stdin.isTTY) {
      console.error("Error: ompimpa tui requires an interactive TTY terminal.");
      process.exit(1);
    }

    this.running = true;
    process.stdout.write(this.getInitSequence());
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    // Initial state refresh
    await this.refreshState();

    // Input handler
    const onData = (chunk: string) => {
      this.handleInput(chunk);
      if (!this.running) {
        process.stdin.off("data", onData);
        process.exit(0);
      } else {
        this.draw();
      }
    };
    process.stdin.on("data", onData);

    // Resize handler
    const onResize = () => {
      if (this.running) {
        this.draw(true);
      }
    };
    process.stdout.on("resize", onResize);

    // Exit signal guards
    const onSignal = () => {
      this.running = false;
      this.cleanup();
      process.exit(0);
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    process.on("exit", () => this.cleanup());

    // Polling render loop (1000ms data refresh, redraw only on changes)
    const loopInterval = setInterval(async () => {
      if (!this.running) {
        clearInterval(loopInterval);
        return;
      }
      await this.refreshState();
      this.draw();
    }, 1000);

    // Initial frame forced
    this.draw(true);
  }
}

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const targetDir = resolveTuiTargetDir(process.cwd(), options.targetDir);
  const controller = new TuiController({ ...options, targetDir });
  await controller.start();
}
