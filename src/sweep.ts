import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface DeferredEntry {
  id: string;
  title: string;
  priority: string; // P2 etc
  status: string; // open, done, promoted
  source?: string;
  intent?: string;
}

export interface SweepResult {
  promoted: string[];
  skipped: string[];
  alreadyReady: string[];
  dryRun: boolean;
}

/**
 * C-02 Deferred-Work + ompimpa sweep (Worktree OMP Native)
 * Port deferred-work.md + bmad-loop sweep agyimpa → _ompimpa/deferred.md + src/sweep.ts
 * AC-C02-1: deferred.md 2 P2 → sweep promote ready-for-dev
 */

export async function loadDeferredEntries(targetDir: string = process.cwd()): Promise<DeferredEntry[]> {
  const deferredPath = path.join(targetDir, "_ompimpa", "deferred.md");
  try {
    const content = await fs.readFile(deferredPath, "utf-8");
    return parseDeferredMd(content);
  } catch {
    return [];
  }
}

export function parseDeferredMd(content: string): DeferredEntry[] {
  const entries: DeferredEntry[] = [];
  const lines = content.split("\n");
  let cur: Partial<DeferredEntry> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // Detect "- id: DW-01"
    const idMatch = line.match(/^\s*-\s*id:\s*["']?([A-Za-z0-9_-]+)["']?\s*$/);
    if (idMatch) {
      if (cur && cur.id) {
        entries.push({
          id: cur.id,
          title: cur.title || cur.id,
          priority: cur.priority || "P2",
          status: cur.status || "open",
          source: cur.source,
          intent: cur.intent,
        });
      }
      cur = { id: idMatch[1] };
      continue;
    }
    if (!cur) continue;
    const titleMatch = line.match(/^\s*title:\s*["']?(.*?)["']?\s*$/);
    if (titleMatch) { cur.title = titleMatch[1]; continue; }
    const prioMatch = line.match(/^\s*priority:\s*["']?([Pp]\d)["']?/);
    if (prioMatch) { cur.priority = prioMatch[1].toUpperCase(); continue; }
    const statusMatch = line.match(/^\s*status:\s*["']?([a-zA-Z_-]+)["']?/);
    if (statusMatch) { cur.status = statusMatch[1]; continue; }
    const sourceMatch = line.match(/^\s*source:\s*["']?(.*?)["']?\s*$/);
    if (sourceMatch) { cur.source = sourceMatch[1]; continue; }
    const intentMatch = line.match(/^\s*intent:\s*["']?(.*?)["']?\s*$/);
    if (intentMatch) { cur.intent = intentMatch[1]; continue; }
  }
  if (cur && cur.id) {
    entries.push({
      id: cur.id,
      title: cur.title || cur.id,
      priority: cur.priority || "P2",
      status: cur.status || "open",
      source: cur.source,
      intent: cur.intent,
    });
  }
  // Also parse table rows | DW-01 | Title | P2 | open |
  const tableRows = content.match(/^\|\s*(DW-[A-Za-z0-9_-]+)\s*\|.*$/gm);
  if (tableRows) {
    for (const row of tableRows) {
      const cols = row.split("|").map((s) => s.trim()).filter(Boolean);
      // Expect: ID, Title, Priority, Status
      if (cols.length >= 4) {
        const [id, title, priority, status] = cols;
        if (id.startsWith("DW-") && !entries.some((e) => e.id === id)) {
          entries.push({ id, title, priority: priority || "P2", status: status || "open" });
        }
      }
    }
  }
  // Deduplicate by id keep first
  const seen = new Map<string, DeferredEntry>();
  for (const e of entries) if (!seen.has(e.id)) seen.set(e.id, e);
  return Array.from(seen.values());
}

export async function sweep(targetDir: string = process.cwd(), opts: { dryRun?: boolean } = {}): Promise<SweepResult> {
  const dryRun = !!opts.dryRun;
  const entries = await loadDeferredEntries(targetDir);
  const open = entries.filter((e) => e.status === "open" && e.priority === "P2");

  const statusPath = path.join(targetDir, "_ompimpa", "status", "feature-status.yaml");
  let statusContent = "";
  try {
    statusContent = await fs.readFile(statusPath, "utf-8");
  } catch {
    statusContent = "";
  }
  const { statusMap } = parseFeatureStatus(statusContent);

  const promoted: string[] = [];
  const skipped: string[] = [];
  const alreadyReady: string[] = [];

  // For each open P2, promote to ready-for-dev if not already done/ready
  for (const entry of open) {
    // Use DW id as story id? In ompimpa, deferred entries are separate from stories.yaml
    // But for AC-C02-1, we simulate promoting 2 items as stories with same IDs or as backlog entries
    // We'll promote by adding entries to feature-status.yaml if missing, or updating status
    const existingStatus = statusMap.get(entry.id);
    if (existingStatus === "done" || existingStatus === "ready-for-dev" || existingStatus === "in-progress") {
      alreadyReady.push(entry.id);
      continue;
    }
    if (dryRun) {
      promoted.push(entry.id);
      continue;
    }
    // Append or update in feature-status.yaml
    // If entry id not in statusMap, we treat as new deferred story and add ready-for-dev
    // Otherwise we update existing
    promoted.push(entry.id);
  }

  if (!dryRun && promoted.length > 0) {
    // Update feature-status.yaml: for each promoted, either update existing or append
    let updatedContent = statusContent;
    for (const id of promoted) {
      if (statusMap.has(id)) {
        // Replace status line for this id
        updatedContent = updatedContent.replace(
          new RegExp(`(- id:\\s*${id}[\\s\\S]*?status:\\s*)[a-zA-Z_-]+`),
          `$1ready-for-dev`
        );
      } else {
        // Append new story entry at end (before kanban summary comments)
        const append = `  - id: ${id}
    title: "${entries.find((e) => e.id === id)?.title || id}"
    status: ready-for-dev
    retries: 0
    epic: DEFERRED
    tea_tier: P2
    assignee: sweep
`;
        // Insert before final comments
        const kanbanIdx = updatedContent.lastIndexOf("# Kanban");
        if (kanbanIdx >= 0) {
          updatedContent = updatedContent.slice(0, kanbanIdx) + append + updatedContent.slice(kanbanIdx);
        } else {
          updatedContent += "\n" + append;
        }
      }
    }
    // Also update deferred.md to mark as promoted (optional)
    await fs.writeFile(statusPath, updatedContent, "utf-8");
    // Mark deferred entries as promoted in deferred.md (simple replace open -> promoted)
    try {
      const deferredPath = path.join(targetDir, "_ompimpa", "deferred.md");
      let deferredContent = await fs.readFile(deferredPath, "utf-8");
      for (const id of promoted) {
        // naive replace status: open -> promoted for this id's block
        deferredContent = deferredContent.replace(
          new RegExp(`(id:\\s*${id}[\\s\\S]*?status:\\s*)open`),
          `$1promoted`
        );
      }
      await fs.writeFile(deferredPath, deferredContent, "utf-8");
    } catch {}
  }

  return { promoted, skipped, alreadyReady, dryRun };
}

// Helper duplicated from prewalk to avoid circular import; keep light
function parseFeatureStatus(content: string): { statusMap: Map<string, string>; doneIds: Set<string> } {
  const statusMap = new Map<string, string>();
  const doneIds = new Set<string>();
  const lines = content.split("\n");
  let curId: string | null = null;
  let curStatus: string | null = null;
  for (const line of lines) {
    const idMatch = line.match(/^\s*-\s*id:\s*["']?([A-Za-z0-9_-]+)["']?/);
    if (idMatch) {
      if (curId && curStatus) {
        statusMap.set(curId, curStatus);
        if (curStatus === "done") doneIds.add(curId);
      }
      curId = idMatch[1];
      curStatus = null;
      continue;
    }
    const statusMatch = line.match(/^\s*status:\s*["']?([a-zA-Z_-]+)["']?/);
    if (statusMatch && curId) curStatus = statusMatch[1];
  }
  if (curId && curStatus) {
    statusMap.set(curId, curStatus);
    if (curStatus === "done") doneIds.add(curId);
  }
  return { statusMap, doneIds };
}
