import type { StoryStatusItem } from "../data";
import { truncateAnsi, padAnsi, stripAnsi, visibleLength } from "../terminal";
export interface RenderStoriesOptions {
  stories: StoryStatusItem[];
  selectedIndex: number;
  width: number;
  height: number;
}

export interface RenderCardOptions {
  story: StoryStatusItem;
  specMarkdown?: string;
  width: number;
  height: number;
}

const STATUS_GLYPHS: Record<string, string> = {
  done: "✔",
  "in-progress": "▶",
  "in-review": "▶",
  "ready-for-dev": "⏳",
  "ready-for-atdd": "⏳",
  backlog: "⏳",
  failed: "✖",
  paused: "⏸",
};

const STATUS_COLORS: Record<string, string> = {
  done: "\x1b[32m", // green
  "in-progress": "\x1b[33;1m", // bold yellow
  "in-review": "\x1b[36;1m", // bold cyan
  "ready-for-dev": "\x1b[90m", // dim gray
  "ready-for-atdd": "\x1b[90m",
  backlog: "\x1b[90m",
  failed: "\x1b[31;1m", // bold red
  paused: "\x1b[35m", // magenta
};

/**
 * Renders stories list for the left sidebar with status glyphs, tier tags, and cursor indicator.
 */
export function renderStoriesTable(options: RenderStoriesOptions): string[] {
  const { stories, selectedIndex, width, height } = options;
  const lines: string[] = [];
  const reset = "\x1b[0m";

  const maxRows = Math.max(1, height);
  // Calculate scroll window if stories count exceeds height
  let startIndex = 0;
  if (selectedIndex >= maxRows) {
    startIndex = selectedIndex - maxRows + 1;
  }
  const visibleStories = stories.slice(startIndex, startIndex + maxRows);

  for (let i = 0; i < visibleStories.length; i++) {
    const realIndex = startIndex + i;
    const story = visibleStories[i];
    const isSelected = realIndex === selectedIndex;

    const glyphChar = STATUS_GLYPHS[story.status] || "?";
    const glyphColor = STATUS_COLORS[story.status] || "\x1b[90m";
    const glyphWidth = visibleLength(glyphChar);
    const paddedGlyphChar = glyphWidth === 1 ? `${glyphChar} ` : glyphChar;
    const glyph = `${glyphColor}${paddedGlyphChar}${reset}`;

    const cursor = isSelected ? "\x1b[33;1m>\x1b[0m" : " ";
    const idStr = `\x1b[1m${story.id}\x1b[0m`;
    const tierTag = `\x1b[90m[${story.tea_tier || "P1"}]\x1b[0m`;

    // Calculate space for title
    const prefixVisual = `${isSelected ? ">" : " "} ${paddedGlyphChar} ${story.id} [${story.tea_tier || "P1"}] `;
    const remainingWidth = Math.max(0, width - visibleLength(prefixVisual));
    const safeTitle = truncateAnsi(story.title, remainingWidth);

    const fullLine = `${cursor} ${glyph} ${idStr} ${tierTag} ${safeTitle}`;
    const truncated = truncateAnsi(fullLine, width);
    lines.push(padAnsi(truncated, width));
  }
  // Fill remaining rows if any
  while (lines.length < maxRows) {
    lines.push(" ".repeat(width));
  }

  return lines;
}

/**
 * Renders the detail card for the active or selected story.
 */
export function renderStoryCard(options: RenderCardOptions): string[] {
  const { story, specMarkdown, width, height } = options;
  const lines: string[] = [];
  const reset = "\x1b[0m";

  // Header line: ID + Title
  const header = `\x1b[1;36m[${story.id}]\x1b[0m \x1b[1m${story.title}\x1b[0m`;
  lines.push(padAnsi(truncateAnsi(header, width), width));

  // Metadata line: Status + Tier + Retries
  const glyphColor = STATUS_COLORS[story.status] || "\x1b[90m";
  const statusStr = `${glyphColor}${story.status}${reset}`;
  const meta = `Status: ${statusStr} | Tier: \x1b[1m${story.tea_tier}\x1b[0m | Retries: ${story.retries}`;
  lines.push(padAnsi(truncateAnsi(meta, width), width));
  if (!specMarkdown) {
    lines.push(padAnsi("\x1b[90mSpesifikasi mikro belum dibuat (_ompimpa/specs/SPEC-" + story.id + ".md)\x1b[0m", width));
    return lines;
  }

  lines.push(padAnsi("\x1b[90m" + "─".repeat(width) + reset, width));

  // Parse Spec Markdown
  const specLines = specMarkdown.split("\n");
  let inACSection = false;

  for (const rawLine of specLines) {
    if (lines.length >= height) break;
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("### AC-") || trimmed.startsWith("- **AC-")) {
      inACSection = true;
      const acHeader = `\x1b[32m✔\x1b[0m \x1b[1m${trimmed.replace(/^[#\-\*\s]+/, "")}\x1b[0m`;
      lines.push(padAnsi(truncateAnsi(acHeader, width), width));
    } else if (inACSection && (trimmed.startsWith("- Given") || trimmed.startsWith("- When") || trimmed.startsWith("- Then") || trimmed.startsWith("Given") || trimmed.startsWith("When") || trimmed.startsWith("Then"))) {
      const gherkinLine = `   \x1b[90m${trimmed}\x1b[0m`;
      lines.push(padAnsi(truncateAnsi(gherkinLine, width), width));
    } else if (trimmed.startsWith("## ") && !trimmed.includes("Kriteria Penerimaan")) {
      inACSection = false;
    }
  }


  return lines;
}
