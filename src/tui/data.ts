import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import yaml from "yaml";

export type StoryStatus =
  | "done"
  | "in-progress"
  | "in-review"
  | "ready-for-dev"
  | "ready-for-atdd"
  | "backlog"
  | "failed"
  | string;

export interface StoryStatusItem {
  id: string;
  title: string;
  epic: string;
  status: StoryStatus;
  tea_tier: string;
  priority: string;
  retries: number;
}

export interface KanbanState {
  epicId: string;
  stories: StoryStatusItem[];
  activeStoryId: string | null;
  lastUpdated: number;
}

export interface SessionEvent {
  id: string;
  timestamp: string;
  type: "tool_call" | "tool_result" | "thinking" | "text" | "unknown";
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  content: string;
}

interface StatSignature {
  mtimeMs: number;
  size: number;
}

async function getStatSig(filePath: string): Promise<StatSignature | null> {
  try {
    const st = await fs.stat(filePath);
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return null;
  }
}

export class StatGatedReader {
  private featureStatusSig: StatSignature | null = null;
  private storiesSig: StatSignature | null = null;
  private cachedKanbanState: KanbanState | null = null;

  // Incremental tracking per session file
  private sessionByteOffsets = new Map<string, number>();
  private sessionPartialBuffers = new Map<string, string>();
  private sessionEventCounter = 0;

  constructor(public readonly targetDir: string) {}

  /**
   * Loads Kanban state from _ompimpa/status/feature-status.yaml and _ompimpa/stories.yaml
   * with stat-gated in-memory caching.
   */
  async loadKanbanState(): Promise<KanbanState> {
    const statusFile = path.join(this.targetDir, "_ompimpa/status/feature-status.yaml");
    const storiesFile = path.join(this.targetDir, "_ompimpa/stories.yaml");

    const curStatusSig = await getStatSig(statusFile);
    const curStoriesSig = await getStatSig(storiesFile);

    const isStatusUnchanged =
      curStatusSig !== null &&
      this.featureStatusSig !== null &&
      curStatusSig.mtimeMs === this.featureStatusSig.mtimeMs &&
      curStatusSig.size === this.featureStatusSig.size;

    const isStoriesUnchanged =
      curStoriesSig === null ||
      (this.storiesSig !== null &&
        curStoriesSig.mtimeMs === this.storiesSig.mtimeMs &&
        curStoriesSig.size === this.storiesSig.size);

    if (this.cachedKanbanState && isStatusUnchanged && isStoriesUnchanged) {
      return this.cachedKanbanState;
    }

    // Load stories metadata from stories.yaml if present
    const storyMetadataMap = new Map<
      string,
      { title: string; epic: string; tea_tier: string; priority: string }
    >();

    if (curStoriesSig !== null) {
      try {
        const rawStories = await fs.readFile(storiesFile, "utf-8");
        const parsed = yaml.parse(rawStories);
        if (parsed && Array.isArray(parsed.stories)) {
          for (const s of parsed.stories) {
            if (s && typeof s === "object" && "id" in s && typeof s.id === "string") {
              storyMetadataMap.set(s.id, {
                title: typeof s.title === "string" ? s.title : s.id,
                epic: typeof s.epic === "string" ? s.epic : "",
                tea_tier: typeof s.tea_tier === "string" ? s.tea_tier : "P1",
                priority: typeof s.priority === "string" ? s.priority : "P1",
              });
            }
          }
        }
      } catch {
        // Tolerant to malformed stories.yaml
      }
    }

    // Load feature-status.yaml
    const stories: StoryStatusItem[] = [];
    let activeStoryId: string | null = null;
    let epicId = "";

    if (curStatusSig !== null) {
      try {
        const rawStatus = await fs.readFile(statusFile, "utf-8");
        const parsed = yaml.parse(rawStatus);
        if (parsed && Array.isArray(parsed.stories)) {
          for (const s of parsed.stories) {
            if (!s || typeof s !== "object" || !("id" in s) || typeof s.id !== "string") {
              continue;
            }
            const meta = storyMetadataMap.get(s.id);
            const item: StoryStatusItem = {
              id: s.id,
              title: typeof s.title === "string" ? s.title : meta?.title || s.id,
              epic: typeof s.epic === "string" ? s.epic : meta?.epic || "",
              status: typeof s.status === "string" ? s.status : "backlog",
              tea_tier: meta?.tea_tier || (typeof s.tea_tier === "string" ? s.tea_tier : "P1"),
              priority: meta?.priority || (typeof s.priority === "string" ? s.priority : "P1"),
              retries: typeof s.retries === "number" ? s.retries : 0,
            };
            stories.push(item);
            if (!epicId && item.epic) {
              epicId = item.epic;
            }

            if (
              !activeStoryId &&
              (item.status === "in-progress" ||
                item.status === "in-review" ||
                item.status === "ready-for-dev")
            ) {
              activeStoryId = item.id;
            }
          }
        }
      } catch {
        // Tolerant to malformed feature-status.yaml
      }
    }

    this.featureStatusSig = curStatusSig;
    this.storiesSig = curStoriesSig;
    this.cachedKanbanState = {
      epicId,
      stories,
      activeStoryId,
      lastUpdated: Date.now(),
    };

    return this.cachedKanbanState;
  }

  /**
   * Discovers the most recently modified omp session file belonging strictly to this.targetDir.
   * Scans ~/.omp/agent/sessions/-<project>/ and verifies cwd inside the session header.
   */
  async findLatestSessionFile(): Promise<string | null> {
    const home = os.homedir();
    const sessionsRoot = path.join(home, ".omp/agent/sessions");
    const baseName = path.basename(this.targetDir);
    const resolvedTarget = path.resolve(this.targetDir);

    const targetDirNames = new Set([
      `-${baseName}`,
      baseName,
      resolvedTarget.replace(/[\/\\]+/g, "-"),
    ]);

    const candidates: string[] = [];

    // 1. Check ~/.omp/agent/sessions/ matching directory names
    try {
      const dirents = await fs.readdir(sessionsRoot, { withFileTypes: true });
      for (const d of dirents) {
        if (d.isDirectory()) {
          if (targetDirNames.has(d.name) || d.name.endsWith(baseName)) {
            const subDir = path.join(sessionsRoot, d.name);
            try {
              const files = await fs.readdir(subDir);
              for (const f of files) {
                if (f.endsWith(".jsonl")) {
                  candidates.push(path.join(subDir, f));
                }
              }
            } catch {
              // Ignore unreadable dirs
            }
          }
        }
      }
    } catch {
      // Ignore missing root
    }

    // 2. Also check project-local session directories if present
    const localSessions = path.join(this.targetDir, ".omp/agent/sessions");
    try {
      const localFiles = await fs.readdir(localSessions);
      for (const f of localFiles) {
        if (f.endsWith(".jsonl")) {
          candidates.push(path.join(localSessions, f));
        }
      }
    } catch {
      // Ignore missing local dir
    }

    if (candidates.length === 0) return null;

    // Filter and select the newest file matching this.targetDir cwd
    let newestFile: string | null = null;
    let newestMtime = -1;

    for (const f of candidates) {
      try {
        const st = await fs.stat(f);
        if (st.mtimeMs <= newestMtime) continue;

        const isMatch = await this.verifySessionBelongsToTarget(f, resolvedTarget);
        if (isMatch) {
          newestMtime = st.mtimeMs;
          newestFile = f;
        }
      } catch {
        // Ignore unreadable
      }
    }

    return newestFile;
  }

  private async verifySessionBelongsToTarget(filePath: string, resolvedTarget: string): Promise<boolean> {
    try {
      const fd = await fs.open(filePath, "r");
      try {
        const buf = Buffer.alloc(4096);
        const { bytesRead } = await fd.read(buf, 0, 4096, 0);
        const text = buf.toString("utf-8", 0, bytesRead);
        const lines = text.split("\n");
        for (const line of lines.slice(0, 5)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object" && typeof parsed.cwd === "string") {
              return path.resolve(parsed.cwd) === resolvedTarget;
            }
          } catch {
            // skip non-json
          }
        }
      } finally {
        await fd.close();
      }
      // Fallback: check parent directory name
      const parentDirName = path.basename(path.dirname(filePath));
      return parentDirName === `-${path.basename(resolvedTarget)}` || parentDirName === path.basename(resolvedTarget);
    } catch {
      return false;
    }
  }

  /**
   * Incrementally tails session events from a JSONL file with line-boundary guards.
   * Guarantees that partial lines without trailing newline are buffered and not parsed.
   */
  async tailSessionEvents(sessionFilePath: string): Promise<SessionEvent[]> {
    let offset = this.sessionByteOffsets.get(sessionFilePath) || 0;
    let partial = this.sessionPartialBuffers.get(sessionFilePath) || "";
    const newEvents: SessionEvent[] = [];

    try {
      const st = await fs.stat(sessionFilePath);
      if (st.size < offset) {
        // File was truncated or rotated; reset offset
        offset = 0;
        partial = "";
      }

      if (st.size === offset) {
        return [];
      }

      const bytesToRead = st.size - offset;
      const buffer = Buffer.alloc(bytesToRead);

      // Open and read chunk
      const fd = await fs.open(sessionFilePath, "r");
      try {
        await fd.read(buffer, 0, bytesToRead, offset);
      } finally {
        await fd.close();
      }

      this.sessionByteOffsets.set(sessionFilePath, st.size);

      const chunk = buffer.toString("utf-8");
      const combined = partial + chunk;

      const lastNewlineIndex = combined.lastIndexOf("\n");
      if (lastNewlineIndex === -1) {
        // No complete line yet; buffer everything
        this.sessionPartialBuffers.set(sessionFilePath, combined);
        return [];
      }

      const completeChunk = combined.slice(0, lastNewlineIndex);
      const remaining = combined.slice(lastNewlineIndex + 1);
      this.sessionPartialBuffers.set(sessionFilePath, remaining);

      const lines = completeChunk.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === "object") {
            const extracted = this.extractEventsFromParsedRecord(parsed as Record<string, unknown>);
            newEvents.push(...extracted);
          }
        } catch {
          // Ignore invalid JSON line
        }
      }

      return newEvents;
    } catch {
      return [];
    }
  }

  private extractEventsFromParsedRecord(record: Record<string, unknown>): SessionEvent[] {
    const events: SessionEvent[] = [];
    const timestamp = typeof record.timestamp === "string" ? record.timestamp : new Date().toISOString();

    if (record.type === "message") {
      const msg = (record.message && typeof record.message === "object" ? record.message : {}) as Record<string, unknown>;
      const role = msg.role;
      const content = msg.content;

      if (role === "assistant" && Array.isArray(content)) {
        for (const item of content) {
          if (!item || typeof item !== "object") continue;

          if (item.type === "toolCall") {
            this.sessionEventCounter++;
            const args = (item.arguments && typeof item.arguments === "object" ? item.arguments : {}) as Record<string, unknown>;
            events.push({
              id: `evt-${this.sessionEventCounter}`,
              timestamp,
              type: "tool_call",
              toolName: typeof item.name === "string" ? item.name : "unknown",
              toolArgs: args,
              content: JSON.stringify(args),
            });
          } else if (item.type === "thinking") {
            this.sessionEventCounter++;
            events.push({
              id: `evt-${this.sessionEventCounter}`,
              timestamp,
              type: "thinking",
              content: typeof item.thinking === "string" ? item.thinking : (typeof item.text === "string" ? item.text : ""),
            });
          } else if (item.type === "text" && typeof item.text === "string" && item.text) {
            this.sessionEventCounter++;
            events.push({
              id: `evt-${this.sessionEventCounter}`,
              timestamp,
              type: "text",
              content: item.text,
            });
          }
        }
      } else if (role === "toolResult") {
        let textContent = "";
        if (Array.isArray(content)) {
          textContent = content
            .map((c) => (typeof c === "string" ? c : (c && typeof c === "object" && "text" in c && typeof c.text === "string" ? c.text : "")))
            .join("\n");
        } else if (typeof content === "string") {
          textContent = content;
        }

        this.sessionEventCounter++;
        const toolName = typeof record.toolName === "string" ? record.toolName : (typeof msg.toolName === "string" ? msg.toolName : undefined);
        events.push({
          id: `evt-${this.sessionEventCounter}`,
          timestamp,
          type: "tool_result",
          toolName,
          content: textContent,
        });
      }
    }

    return events;
  }
}
