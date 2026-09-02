import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface TriageFinding {
  file?: string;
  line?: number | null;
  column?: number | null;
  ruleId: string;
  rule_violation?: string;
  category?: string;
  severity: string; // "Critical"|"High"|"Medium"|"Low"|"P0"|"P1"|"P2"
  message?: string;
  remediation?: string;
  recommendation?: string;
  sources?: string[];
  merged_sources?: number;
  penalty?: number;
}

export interface RegistryEntry {
  id: string;
  penalty: number;
  default_severity: string;
  ompimpa_panel?: string[];
  reviewer_sources?: string[];
}

export interface Registry {
  criteria: RegistryEntry[];
  scoring_weights: { Critical: number; High: number; Medium: number; Low: number };
  scoring_formula?: string;
}

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function severityWeight(sev: string): number {
  const s = sev.toLowerCase();
  if (s === "critical" || s === "p0") return 30;
  if (s === "high" || s === "p1") return 15;
  if (s === "medium" || s === "p2-medium") return 5;
  if (s === "low" || s === "p2" || s === "p2-low") return 2;
  // fallback: treat P2 as Medium 5 for B-02 compatibility
  if (s === "p2") return 5;
  return 5;
}

function severityRank(sev: string): number {
  // higher rank = more severe
  const w = severityWeight(sev);
  // 30 >15 >5 >2
  return w;
}

export async function loadRegistry(registryPath?: string): Promise<Registry> {
  const p = registryPath || path.join(REPO_ROOT, "_ompimpa", "criteria_registry_35.json");
  const alt = path.join(REPO_ROOT, "_ompimpa", "data", "criteria_registry_35.json");
  let content: string | null = null;
  try {
    content = await fs.readFile(p, "utf-8");
  } catch {
    try {
      content = await fs.readFile(alt, "utf-8");
    } catch {
      throw new Error(`Registry not found at ${p} or ${alt}`);
    }
  }
  const json = JSON.parse(content!);
  // Validate 35 entries
  if (!json.criteria || !Array.isArray(json.criteria)) throw new Error("Invalid registry: missing criteria");
  return json as Registry;
}

export function deduplicateFindings(findings: TriageFinding[]): TriageFinding[] {
  const map = new Map<string, TriageFinding>();
  for (const f of findings) {
    const file = f.file || "global";
    const linePart = f.line == null ? "" : String(f.line);
    // Key: file:line:ruleId (A-02 AC-B02-3: file-level line=null => file:ruleId)
    const key = linePart ? `${file}:${linePart}:${f.ruleId}` : `${file}:${f.ruleId}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...f, merged_sources: 1, sources: f.sources || [f.ruleId] });
    } else {
      // Keep highest severity
      const existingRank = severityRank(existing.severity);
      const newRank = severityRank(f.severity);
      // Merge sources count
      const mergedCount = (existing.merged_sources || 1) + 1;
      const mergedSources = [...(existing.sources || []), ...(f.sources || [f.ruleId])];
      if (newRank > existingRank) {
        map.set(key, { ...f, merged_sources: mergedCount, sources: mergedSources });
      } else {
        // keep existing but update merged count
        map.set(key, { ...existing, merged_sources: mergedCount, sources: mergedSources });
      }
    }
  }
  return Array.from(map.values());
}

export interface ScoreResult {
  score: number;
  verdict: "PASS" | "REMEDIATE";
  p0Count: number;
  p1Count: number;
  p2Count: number;
  totalDeduction: number;
  breakdown?: { severity: string; count: number; penalty: number }[];
}

export function calculateScore(findings: TriageFinding[]): ScoreResult {
  let total = 0;
  let p0 = 0, p1 = 0, p2 = 0;
  for (const f of findings) {
    const w = severityWeight(f.severity);
    total += w;
    if (w === 30) p0++;
    else if (w === 15) p1++;
    else p2++; // 5 or 2 both count as P2 for summary
  }
  const score = Math.max(0, 100 - total);
  const verdict: "PASS" | "REMEDIATE" = score === 100 && findings.length === 0 ? "PASS" : score === 100 ? "PASS" : "REMEDIATE";
  // For v2 allow_p2_nits=false, even Low makes REMEDIATE (since score <100)
  const finalVerdict = score === 100 ? "PASS" : "REMEDIATE";
  return { score, verdict: finalVerdict, p0Count: p0, p1Count: p1, p2Count: p2, totalDeduction: total };
}

// Alias for reviewer compatibility
export const calculateScorecard = calculateScore;

export function remediationPlan(findings: TriageFinding[]): TriageFinding[] {
  // Sorted P0 -> P1 -> P2 (Critical -> High -> Medium/Low)
  return [...findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

export function appendPitfall(entry: string, pitfallsPath?: string): Promise<void> {
  // Stub for C-03: append to rules/pitfalls.md (not used in EPIC-A but provided for completeness)
  return Promise.resolve();
}
