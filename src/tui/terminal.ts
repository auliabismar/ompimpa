export interface PaneGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutGeometry {
  header: PaneGeometry;
  sidebar: PaneGeometry;
  main: PaneGeometry;
  footer: PaneGeometry;
  cols: number;
  rows: number;
}

// Comprehensive ANSI escape code regex (CSI, OSC, color codes, DEC private modes)
const ANSI_REGEX = /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

/**
 * Returns visual terminal cell width of a single Unicode code point.
 * 0 for control/combining/zero-width, 2 for wide/fullwidth/emojis, 1 otherwise.
 */
export function getCodePointWidth(cp: number): number {
  if (cp === 0) return 0;
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;

  // Combining marks, variation selectors, zero-width spaces
  if (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x206f) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) || // variation selectors
    (cp >= 0xe0100 && cp <= 0xe01ef)
  ) {
    return 0;
  }

  // Fast ASCII printable
  if (cp < 0x7f) return 1;

  // Explicit narrow symbols in TUI
  if (
    cp === 0x2714 || // ✔
    cp === 0x2716 || // ✖
    cp === 0x25b6 || // ▶
    cp === 0x21b3 || // ↳
    cp === 0x2026    // …
  ) {
    return 1;
  }

  // Box drawing & block elements
  if (cp >= 0x2500 && cp <= 0x259f) return 1;

  // 2-column emoji/symbols in BMP
  if (
    cp === 0x231a || cp === 0x231b || // ⌚, ⌛
    (cp >= 0x23e9 && cp <= 0x23f3) || // ⏩, ⏳, etc.
    (cp >= 0x23f8 && cp <= 0x23fa) || // ⏸, ⏹, ⏺
    cp === 0x26a1 ||                  // ⚡
    cp === 0x270f ||                  // ✏
    cp === 0x2705 ||                  // ✅
    cp === 0x2728 ||                  // ✨
    cp === 0x274c                     // ❌
  ) {
    return 2;
  }

  // East Asian Wide, Fullwidth & SMP Emojis
  if (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility
    (cp >= 0xfe10 && cp <= 0xfe19) || // Vertical forms
    (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK Compatibility Forms
    (cp >= 0xff01 && cp <= 0xff60) || // Fullwidth Forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f000 && cp <= 0x1faff)   // Emojis (📋, 🎯, 💭, 📖, 📝, etc.)
  ) {
    return 2;
  }

  return 1;
}

/**
 * Strips all ANSI escape codes from string, leaving only plain visible characters.
 */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}

/**
 * Calculates visual display length of string in terminal columns, ignoring ANSI codes
 * and correctly accounting for double-width Unicode characters and emojis.
 */
export function visibleLength(str: string): number {
  const stripped = stripAnsi(str);
  let width = 0;
  for (const ch of stripped) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) {
      width += getCodePointWidth(cp);
    }
  }
  return width;
}

/**
 * Pads a string containing ANSI escape codes to a target visual terminal width.
 */
export function padAnsi(
  str: string,
  width: number,
  align: "left" | "right" | "center" = "left"
): string {
  const len = visibleLength(str);
  const diff = width - len;
  if (diff <= 0) return str;

  if (align === "left") {
    return str + " ".repeat(diff);
  } else if (align === "right") {
    return " ".repeat(diff) + str;
  } else {
    const leftPad = Math.floor(diff / 2);
    const rightPad = diff - leftPad;
    return " ".repeat(leftPad) + str + " ".repeat(rightPad);
  }
}

/**
 * Safely truncates a string containing ANSI escape codes at a visual character boundary.
 * Handles surrogate pairs and double-width characters without splitting code points.
 * Always appends an ellipsis and reset sequence (\x1b[0m) if truncated.
 */
export function truncateAnsi(str: string, maxWidth: number): string {
  const currentLen = visibleLength(str);
  if (currentLen <= maxWidth) {
    return str;
  }

  if (maxWidth <= 1) {
    return "…\x1b[0m";
  }

  const targetVisible = maxWidth - 1; // 1 column for ellipsis '…'
  let visibleCount = 0;
  let result = "";
  let i = 0;

  while (i < str.length) {
    // Check if start of ANSI sequence (\x1b)
    if (str.charCodeAt(i) === 27) {
      const sub = str.slice(i);
      const match = sub.match(/^(\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]))/);
      if (match) {
        result += match[1];
        i += match[1].length;
        continue;
      }
    }

    // Read full Unicode code point (surrogate pair safe)
    const cp = str.codePointAt(i);
    if (cp === undefined) break;

    const charLen = cp > 0xffff ? 2 : 1;
    const ch = str.slice(i, i + charLen);
    const w = getCodePointWidth(cp);

    if (visibleCount + w > targetVisible) {
      break;
    }

    result += ch;
    visibleCount += w;
    i += charLen;
  }

  return result + "…\x1b[0m";
}

/**
 * Renders a closed Unicode box border [┌─┐│└─┘] with title and padded content lines.
 * Guarantees every output line has visual width matching the exact requested width.
 */
export function renderBox(
  title: string,
  contentLines: string[],
  width: number,
  height: number,
  borderColor: string = "\x1b[90m" // default dim gray
): string[] {
  const reset = "\x1b[0m";
  const lines: string[] = [];

  const innerWidth = Math.max(0, width - 2);

  // Top line: ┌─ Title ──────┐
  let topLine = "";
  if (title) {
    const safeTitle = truncateAnsi(title, Math.max(0, innerWidth - 4));
    const titleWidth = visibleLength(safeTitle);
    const rightDashCount = Math.max(0, innerWidth - titleWidth - 3);
    topLine = `${borderColor}┌─ ${reset}${safeTitle} ${borderColor}${"─".repeat(rightDashCount)}┐${reset}`;
  } else {
    topLine = `${borderColor}┌${"─".repeat(innerWidth)}┐${reset}`;
  }
  lines.push(topLine);

  // Content lines
  const contentHeight = Math.max(0, height - 2);
  for (let row = 0; row < contentHeight; row++) {
    const rawLine = contentLines[row] || "";
    const truncatedContent = truncateAnsi(rawLine, innerWidth);
    const paddedContent = padAnsi(truncatedContent, innerWidth, "left");
    lines.push(`${borderColor}│${reset}${paddedContent}${borderColor}│${reset}`);
  }

  // Bottom line: └──────┘
  const bottomLine = `${borderColor}└${"─".repeat(innerWidth)}┘${reset}`;
  lines.push(bottomLine);

  return lines;
}
/**
 * Renders a unified split-pane container with top and bottom sections separated by
 * a middle divider [├─ Title ─┤].
 * Guarantees every output line has visual width matching the exact requested width,
 * with closed left and right borders [│...│].
 */
export function renderSplitPane(
  topTitle: string,
  topLines: string[],
  topContentRows: number,
  bottomTitle: string,
  bottomLines: string[],
  totalHeight: number,
  width: number,
  borderColor: string = "\x1b[90m"
): string[] {
  const reset = "\x1b[0m";
  const lines: string[] = [];
  const innerWidth = Math.max(0, width - 2);

  // Allocate content row counts:
  // Total lines = 1 (top border) + actualTopRows + 1 (divider) + actualBottomRows + 1 (bottom border) = totalHeight
  // Therefore actualTopRows + actualBottomRows = totalHeight - 3
  const availableContent = Math.max(2, totalHeight - 3);
  const actualTopRows = Math.min(
    Math.max(1, topContentRows),
    Math.max(1, availableContent - 1)
  );
  const actualBottomRows = Math.max(1, availableContent - actualTopRows);

  // 1. Top Border: ┌─ Title ──────┐
  let topLine = "";
  if (topTitle) {
    const safeTitle = truncateAnsi(topTitle, Math.max(0, innerWidth - 4));
    const titleWidth = visibleLength(safeTitle);
    const rightDash = Math.max(0, innerWidth - titleWidth - 3);
    topLine = `${borderColor}┌─ ${reset}${safeTitle} ${borderColor}${"─".repeat(rightDash)}┐${reset}`;
  } else {
    topLine = `${borderColor}┌${"─".repeat(innerWidth)}┐${reset}`;
  }
  lines.push(topLine);

  // 2. Top Content Lines
  for (let r = 0; r < actualTopRows; r++) {
    const raw = topLines[r] || "";
    const truncated = truncateAnsi(raw, innerWidth);
    const padded = padAnsi(truncated, innerWidth, "left");
    lines.push(`${borderColor}│${reset}${padded}${borderColor}│${reset}`);
  }

  // 3. Middle Divider: ├─ Title ──────┤
  let midLine = "";
  if (bottomTitle) {
    const safeTitle = truncateAnsi(bottomTitle, Math.max(0, innerWidth - 4));
    const titleWidth = visibleLength(safeTitle);
    const rightDash = Math.max(0, innerWidth - titleWidth - 3);
    midLine = `${borderColor}├─ ${reset}${safeTitle} ${borderColor}${"─".repeat(rightDash)}┤${reset}`;
  } else {
    midLine = `${borderColor}├${"─".repeat(innerWidth)}┤${reset}`;
  }
  lines.push(midLine);

  // 4. Bottom Content Lines
  for (let r = 0; r < actualBottomRows; r++) {
    const raw = bottomLines[r] || "";
    const truncated = truncateAnsi(raw, innerWidth);
    const padded = padAnsi(truncated, innerWidth, "left");
    lines.push(`${borderColor}│${reset}${padded}${borderColor}│${reset}`);
  }

  // 5. Bottom Border: └──────┘
  const bottomLine = `${borderColor}└${"─".repeat(innerWidth)}┘${reset}`;
  lines.push(bottomLine);

  return lines;
}

/**
 * Calculates responsive split-pane layout geometry based on columns and rows.
 */
export function calculateLayout(cols: number, rows: number): LayoutGeometry {
  const headerHeight = 3;
  const footerHeight = 1; // 1 row for footer shortcuts (no trailing empty line)
  const middleHeight = Math.max(1, rows - headerHeight - footerHeight);

  // Sidebar width: 28% of cols, clamped between 28 and 36, or min 20 if small terminal
  const rawSidebar = Math.floor(cols * 0.28);
  const minSidebar = cols < 80 ? 20 : 28;
  const sidebarWidth = Math.max(minSidebar, Math.min(36, rawSidebar));
  const mainWidth = Math.max(30, cols - sidebarWidth);

  return {
    cols,
    rows,
    header: {
      x: 0,
      y: 0,
      width: cols,
      height: headerHeight,
    },
    footer: {
      x: 0,
      y: Math.max(0, rows - footerHeight),
      width: cols,
      height: footerHeight,
    },
    sidebar: {
      x: 0,
      y: headerHeight,
      width: sidebarWidth,
      height: middleHeight,
    },
    main: {
      x: sidebarWidth,
      y: headerHeight,
      width: mainWidth,
      height: middleHeight,
    },
  };
}
