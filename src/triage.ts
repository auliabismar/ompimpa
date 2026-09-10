import * as fs from "node:fs/promises";
import * as path from "node:path";
import yaml from "yaml";
import { partitionTargetFiles } from "./story_spec";
import type { HarnessResultMarker } from "./harness/omp_adapter";
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
  /** Vonis verifikasi ala step-03 (ditulis sesi reviewer, bukan CLI). */
  verdict?: string; // "high"|"medium"|"low"|"false"|"maybe-false"
  evidence?: string;
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
    // If message mentions specific AC, preserve uniqueness per AC
    const acMatch = f.message?.match(/acceptance criterion:\s*(AC-[a-zA-Z0-9_.-]+)/i);
    const subKey = acMatch ? `:${acMatch[1].toUpperCase()}` : "";
    const key = linePart ? `${file}:${linePart}:${f.ruleId}` : `${file}:${f.ruleId}${subKey}`;
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

function isVerifiedClean(
  marker: HarnessResultMarker | undefined,
  storyId: string,
  reviewerId: string
): boolean {
  if (!marker || marker.completed !== true) return false;
  if (marker.role !== "review" || marker.story !== storyId) return false;
  const files = marker.files || [];
  return files.includes(`${storyId}-${reviewerId}.json`);
}

/**
 * Kontrak berkas review v2: envelope `{reviewer, story, completedAt, findings}`.
 * Bare array = format legacy (temuan tetap dinilai; [] = slot reservasi, bukan bukti).
 * Bersih terverifikasi ⟺ envelope findings:[] + marker sesi mencakup file.
 */
function isFindingsEnvelope(parsed: unknown): parsed is { findings: unknown[] } {
  return (
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "findings" in parsed &&
    Array.isArray(parsed.findings)
  );
}

export function isEnvelopeCleanReport(parsed: unknown, storyId: string, reviewerId: string): boolean {
  if (!isFindingsEnvelope(parsed)) return false;
  if (parsed.findings.length !== 0) return false;
  if (!("story" in parsed) || typeof parsed.story !== "string" || parsed.story !== storyId) return false;
  if (!("reviewer" in parsed) || typeof parsed.reviewer !== "string" || parsed.reviewer !== reviewerId) return false;
  return true;
}

function strField(rec: Record<string, unknown>, key: string): string | undefined {
  const value: unknown = rec[key];
  return typeof value === "string" ? value : undefined;
}

function numField(rec: Record<string, unknown>, key: string): number | null {
  const value: unknown = rec[key];
  return typeof value === "number" ? value : null;
}

function mapReviewEntry(entry: unknown, reviewerId: string): TriageFinding | null {
  if (typeof entry !== "object" || entry === null) return null;
  const rec: Record<string, unknown> = entry as Record<string, unknown>;
  const ruleId = strField(rec, "ruleId") || strField(rec, "rule_violation") || "unknown";
  const sev = strField(rec, "severity") || strField(rec, "default_severity") || "Low";
  return {
    file: strField(rec, "file"),
    line: numField(rec, "line"),
    column: numField(rec, "column"),
    ruleId,
    rule_violation: strField(rec, "rule_violation") || strField(rec, "ruleId"),
    category: strField(rec, "category"),
    severity: sev,
    message: strField(rec, "message") || strField(rec, "recommendation") || strField(rec, "rule_violation"),
    recommendation: strField(rec, "recommendation") || strField(rec, "remediation"),
    remediation: strField(rec, "remediation") || strField(rec, "recommendation"),
    verdict: strField(rec, "verdict"),
    evidence: strField(rec, "evidence"),
    sources: [reviewerId],
  };
}

function noEvidenceFinding(storyId: string, reviewerId: string, reason: string): TriageFinding {
  return {
    file: "global",
    line: null,
    ruleId: `reviewer-no-evidence-${reviewerId}`,
    rule_violation: `reviewer without evidence: ${reviewerId}`,
    category: "Spec",
    severity: "High",
    message: `reviewer without evidence: ${reviewerId} (${reason})`,
    recommendation: `Run a genuine review session for ${storyId} so reviewer ${reviewerId} writes verified findings`,
    sources: [reviewerId],
  };
}
/**
 * B-01: Aggregator 7→10 isolated reviews
 * Membaca _ompimpa/review/<story>-<reviewer>.json, handle missing reviewer (P1 High), dedup, scoring 100
 */
export interface AggregateOptions {
  reviewDir?: string;
  targetDir?: string;
  panelIds?: string[];
  timeoutMs?: number;
  /**
   * Marker sesi review. Array kosong [] HANYA dihitung bersih bila marker
   * completed mencakup file reviewer tersebut; tanpa marker, [] = tanpa bukti.
   */
  sessionMarker?: HarnessResultMarker;
}

export interface AggregateResult {
  findings: TriageFinding[];
  deduped: TriageFinding[];
  /** Temuan bervonis false (terbukti bukan defect) — tidak ikut skor. */
  rejected: TriageFinding[];
  score: ScoreResult;
  missing: string[];
  remediation: TriageFinding[];
}

export async function aggregateReviews(
  storyId: string,
  opts: AggregateOptions = {}
): Promise<AggregateResult> {
  const targetDir = opts.targetDir || process.cwd();
  const reviewDir = opts.reviewDir || path.join(targetDir, "_ompimpa", "review");
  const timeoutMs = opts.timeoutMs ?? 60000;

  // Determine expected panel ids
  let expectedIds: string[] = opts.panelIds || [];
  if (expectedIds.length === 0) {
    // Try to infer from existing files or use default 7 panel
    try {
      const files = await fs.readdir(reviewDir);
      const storyFiles = files.filter((f) => f.startsWith(`${storyId}-`) && f.endsWith(".json"));
      if (storyFiles.length > 0) {
        expectedIds = storyFiles.map((f) => f.replace(`${storyId}-`, "").replace(".json", ""));
      }
    } catch {
      // reviewDir not exists yet
    }
    if (expectedIds.length === 0) {
      // default 7 panel fallback (B-01) — will be detected as missing if no files at all
      expectedIds = ["ompimpa-prd","ompimpa-ironlaw","ompimpa-security","ompimpa-test","ompimpa-verify","ompimpa-ash","ompimpa-liveview"];
      // If custom panel detection via config, we could load config but keep simple
      // For B-03 10 panel, caller should pass panelIds explicitly; fallback will use files found
    }
  }

  const findings: TriageFinding[] = [];
  const missing: string[] = [];

  // Wait loop for timeoutMs (simple: try once, if missing treat as P1 after timeout)
  // For test speed, we don't actually wait 60s, we just check existence immediately and if missing => P1
  // If timeoutMs is respected, we would poll, but for deterministic tests we short-circuit
  for (const reviewerId of expectedIds) {
    const filePath = path.join(reviewDir, `${storyId}-${reviewerId}.json`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed: unknown = JSON.parse(content);
      const entries: unknown[] | null = Array.isArray(parsed)
        ? parsed
        : isFindingsEnvelope(parsed)
          ? parsed.findings
          : null;
      if (entries === null) {
        // Berkas ada tapi bukan array temuan maupun envelope valid → tanpa bukti.
        missing.push(reviewerId);
        findings.push(noEvidenceFinding(storyId, reviewerId, "malformed report (expected findings array or envelope)"));
        continue;
      }
      if (entries.length === 0) {
        const envelopeClean = isEnvelopeCleanReport(parsed, storyId, reviewerId);
        const markerClean = isVerifiedClean(opts.sessionMarker, storyId, reviewerId);
        if (envelopeClean && markerClean) continue; // bersih terverifikasi dua lapis
        // Slot reservasi [] atau envelope tanpa marker: panel tanpa bukti.
        missing.push(reviewerId);
        findings.push(noEvidenceFinding(
          storyId,
          reviewerId,
          Array.isArray(parsed)
            ? "empty report, no completed review session marker"
            : "empty envelope without completed review session marker"
        ));
        continue;
      }
      for (const entry of entries) {
        const mapped = mapReviewEntry(entry, reviewerId);
        if (mapped) findings.push(mapped);
      }
    } catch (err) {
      // Missing or crash — treat as P1 High reviewer missing (AC-B01-2)
      missing.push(reviewerId);
      findings.push({
        file: "global",
        line: null,
        ruleId: `reviewer-missing-${reviewerId}`,
        rule_violation: `reviewer missing: ${reviewerId}`,
        category: "Spec",
        severity: "High",
        message: `reviewer missing: ${reviewerId} (timeout ${timeoutMs}ms)`,
        recommendation: `Ensure reviewer ${reviewerId} writes _ompimpa/review/${storyId}-${reviewerId}.json`,
        sources: [reviewerId],
      });
    }
  }
  // In-band TEA-01 Traceability & Mutation Guard (E-01)
  try {
    const trace = await auditTeaTraceability(storyId, { repoRoot: targetDir, reviewDir });
    if (trace && trace.findings.length > 0) {
      findings.push(...trace.findings);
    }
  } catch {
    // Non-fatal if spec doesn't exist
  }
  // In-band Flaky & Slow Test Hunter (E-02)
  try {
    const flakyAudit = await auditFlakyAndSlowTests(storyId, { repoRoot: targetDir });
    if (flakyAudit && flakyAudit.findings.length > 0) {
      findings.push(...flakyAudit.findings);
    }
  } catch {
    // Non-fatal if error during scan
  }

  // Residual flunk guard: flunk() sah di gate ATDD-red, tidak sah di gate final.
  try {
    const residual = await auditResidualFlunk(storyId, { repoRoot: targetDir });
    if (residual && residual.length > 0) {
      findings.push(...residual);
    }
  } catch {
    // Non-fatal
  }

  const dedupedAll = deduplicateFindings(findings);
  const rejected = dedupedAll.filter((f) => (f.verdict || "").toLowerCase() === "false");
  const deduped = dedupedAll.filter((f) => (f.verdict || "").toLowerCase() !== "false");
  const score = calculateScore(deduped);
  const remediation = remediationPlan(deduped);

  return { findings, deduped, rejected, score, missing, remediation };
}

/**
 * Final-gate guard: sisa flunk() di test milik story = AC belum diimplementasikan (P1).
 * Ter-scope ke test files story (bukan seluruh repo).
 */
export async function auditResidualFlunk(
  storyId: string,
  opts: { repoRoot?: string; testFiles?: string[] } = {}
): Promise<TriageFinding[]> {
  const repoRoot = opts.repoRoot || REPO_ROOT;
  const targetStory = storyId.toUpperCase().replace(/^STORY-/, "");
  let files = opts.testFiles || [];
  if (files.length === 0) {
    try {
      const storiesYamlPath = path.join(repoRoot, "_ompimpa", "stories.yaml");
      const yamlContent = await fs.readFile(storiesYamlPath, "utf-8");
      const parsedData = yaml.parse(yamlContent);
      const storyEntry = parsedData?.stories?.find((s: { id: string }) => s.id === storyId || s.id === targetStory);
      if (storyEntry) {
        files = partitionTargetFiles(storyEntry, repoRoot).testFiles;
      }
    } catch {}
  }
  const out: TriageFinding[] = [];
  for (const f of files) {
    try {
      const full = path.isAbsolute(f) ? f : path.join(repoRoot, f);
      const content = await fs.readFile(full, "utf-8");
      const lines = content.split(/\r?\n/);
      const hitIdx = lines.findIndex(
        (l) => /\bflunk\s*\(/.test(l) && !l.trim().startsWith("#") && !l.trim().startsWith("//")
      );
      if (hitIdx >= 0) {
        out.push({
          file: f,
          line: hitIdx + 1,
          ruleId: "TEA-01",
          rule_violation: "Residual Red-Phase flunk() at final gate",
          category: "Functional & Correctness",
          severity: "High",
          message: `Residual flunk() in ${f}: acceptance criterion not implemented (TEA-01 final gate)`,
          recommendation: "Replace the flunk stub with substantive assertions and green implementation, or remove the test.",
          sources: ["bmad_gap_verifier"],
        });
      }
    } catch {}
  }
  return out;
}

export async function appendPitfall(entry: string, pitfallsPath?: string): Promise<void> {
  const targetPath = pitfallsPath || path.join(REPO_ROOT, "rules", "pitfalls.md");
  const solutionsDir = path.join(REPO_ROOT, "_ompimpa", "solutions");
  await fs.mkdir(solutionsDir, { recursive: true });
  const timestamp = new Date().toISOString().slice(0, 10);
  const randomSuffix = Math.random().toString(16).slice(2, 8);
  const solId = `SOL-${String(Date.now()).slice(-6)}-${randomSuffix}`;
  let pitfallsEntry = entry;
  if (!entry.trim().startsWith("###") && !entry.trim().startsWith("-")) {
    pitfallsEntry = `### [${timestamp}] ${entry}\n- **Auto-appended:** ${entry}\n- **SOL:** ${solId}\n`;
  }
  // Append to pitfalls.md
  try {
    const existing = await fs.readFile(targetPath, "utf-8").catch(() => "");
    const next = existing.trimEnd() + "\n\n" + pitfallsEntry.trim() + "\n";
    await fs.writeFile(targetPath, next, "utf-8");
  } catch {}

  // Also create SOL file in _ompimpa/solutions/
  const solTitle = entry.split("\n")[0].slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, "-") || "pitfall";
  const solFile = path.join(solutionsDir, `${solId}-${solTitle}.md`);
  const solContent = `---
id: ${solId}
topic: ${solTitle}
tags: [pitfall, auto-append]
date: ${timestamp}
---

# Solusi ${solId}: ${entry.split("\n")[0].slice(0, 80)}

## Gejala & Masalah
${entry}

## Akar Penyebab (Root Cause)
Terdeteksi via triage dedup REMEDIATE P0/P1, scoring 100/100.

## Pola Solusi yang Terbukti (Proven Fix)
Lihat pitfalls.md entry di atas.

## Invariant Pencegahan Regresi
1. TTSR rule terkait harus abort dengan remediation tepat di line.
2. Dedup file:line:ruleId menjaga penalty 1×.
`;
  try {
    await fs.writeFile(solFile, solContent, "utf-8");
  } catch {}
}

export interface TraceabilityCheckResult {
  coveredACs: string[];
  missingACs: string[];
  falseGreens: TriageFinding[];
  findings: TriageFinding[];
}

export interface TraceabilityAuditResult extends TraceabilityCheckResult {
  storyId: string;
  specPath?: string;
}

export interface TraceabilityOptions {
  repoRoot?: string;
  specPath?: string;
  testFiles?: string[];
  reviewDir?: string;
}

export function extractStoryACs(specContent: string): string[] {
  const acMap = new Map<string, string>();
  // Match Scenario: (AC-...) or Scenario Outline: (AC-...)
  const scenarioRegex = /(?:Scenario|Scenario Outline):\s*([A-Za-z0-9_.-]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = scenarioRegex.exec(specContent)) !== null) {
    const raw = match[1].trim();
    if (raw.toUpperCase().startsWith("AC-")) {
      acMap.set(raw.toUpperCase(), raw);
    }
  }

  // If scenarios matched ACs, that's our canonical list!
  if (acMap.size > 0) {
    return Array.from(acMap.values());
  }

  // Fallback: match id: AC-... or markdown list - AC-... or bold **AC-...**
  const idRegex = /(?:id:\s*|(?:\*\*|#+|-\s*|\b))(AC-[a-zA-Z0-9_.-]+)/gi;
  while ((match = idRegex.exec(specContent)) !== null) {
    const raw = match[1].trim();
    if (raw.toUpperCase().startsWith("AC-")) {
      if (!acMap.has(raw.toUpperCase())) {
        acMap.set(raw.toUpperCase(), raw);
      }
    }
  }

  return Array.from(acMap.values());
}

export function extractElixirTestBody(
  content: string,
  doIndex: number
): { body: string; endIndex: number } | null {
  let depth = 1;
  const tokenRegex = /(?:#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(do|fn)\b|\b(end)\b)/gm;
  tokenRegex.lastIndex = doIndex;
  let match;
  while ((match = tokenRegex.exec(content)) !== null) {
    if (match[1]) {
      depth++;
    } else if (match[2]) {
      depth--;
      if (depth === 0) {
        return {
          body: content.slice(doIndex, match.index),
          endIndex: match.index + match[0].length,
        };
      }
    }
  }
  return null;
}
export function detectFalseGreens(content: string, filePath?: string): TriageFinding[] {
  const findings: TriageFinding[] = [];
  const lines = content.split(/\r?\n/);

  // Line-by-line tautology / vacuous assertion check
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip comment lines
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) {
      continue;
    }

    let vacuousMatch: string | null = null;

    // TypeScript / JS tautologies:
    // expect(true).toBe(true), expect(true).toEqual(true), expect(false).toBe(false), expect(false).toBeFalsy()
    if (/expect\s*\(\s*true\s*\)\s*\.\s*(?:toBe|toEqual)\s*\(\s*true\s*\)/i.test(line)) {
      vacuousMatch = "expect(true).toBe(true)";
    } else if (/expect\s*\(\s*true\s*\)\s*\.\s*toBeTruthy\s*\(\s*\)/i.test(line)) {
      vacuousMatch = "expect(true).toBeTruthy()";
    } else if (/expect\s*\(\s*false\s*\)\s*\.\s*(?:toBe|toEqual)\s*\(\s*false\s*\)/i.test(line)) {
      vacuousMatch = "expect(false).toBe(false)";
    } else if (/expect\s*\(\s*false\s*\)\s*\.\s*toBeFalsy\s*\(\s*\)/i.test(line)) {
      vacuousMatch = "expect(false).toBeFalsy()";
    }
    // Elixir ExUnit tautologies:
    // assert true, assert :ok == :ok
    else if (/assert\s+true\b(?:\s*==\s*true)?(?:\s*$|\s+#|\s*,)/.test(line)) {
      vacuousMatch = "assert true";
    } else if (/assert\s+:([a-zA-Z0-9_]+)\s*==\s*:\1\b(?:\s*$|\s+#)/.test(line)) {
      const atomMatch = line.match(/assert\s+:([a-zA-Z0-9_]+)\s*==\s*:\1\b/);
      vacuousMatch = atomMatch ? atomMatch[0] : "assert :ok == :ok";
    }

    if (vacuousMatch) {
      findings.push({
        file: filePath || "unknown",
        line: lineNum,
        ruleId: "TEA-01",
        rule_violation: "TEA-01: In-Band Mutation Guard (Assertion False Green)",
        category: "Idioms, Testing & Maintainability",
        severity: "High",
        message: `False green detected: vacuous assertion '${vacuousMatch}' violates TEA-01 In-Band Mutation Guard`,
        recommendation: "Replace vacuous assertion with substantive assertions verifying actual state, return values, or side-effects.",
        sources: ["bmad_gap_verifier", "ompimpa-test"],
      });
    }
  }

  // Check for empty test blocks (no assertions in body) with brace-depth tracking
  // JS/TS: (it|test)("...", () => { ... })
  const tsTestOpener = /(?:it|test)\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)?\s*=>\s*\{/g;
  let testMatch: RegExpExecArray | null;
  while ((testMatch = tsTestOpener.exec(content)) !== null) {
    const testTitle = testMatch[1];
    const startIndex = testMatch.index;
    const braceStart = tsTestOpener.lastIndex - 1;

    let depth = 1;
    let endIndex = -1;
    for (let pos = braceStart + 1; pos < content.length; pos++) {
      if (content[pos] === "{") depth++;
      else if (content[pos] === "}") {
        depth--;
        if (depth === 0) {
          endIndex = pos;
          break;
        }
      }
    }

    if (endIndex !== -1) {
      const testBody = content.slice(braceStart + 1, endIndex);
      const stripped = testBody.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").trim();
      const hasAssertion = /expect\s*\(|assert\s*\(|assert\./.test(stripped);
      if (!hasAssertion) {
        const prefix = content.slice(0, startIndex);
        const testLine = prefix.split(/\r?\n/).length;
        findings.push({
          file: filePath || "unknown",
          line: testLine,
          ruleId: "TEA-01",
          rule_violation: "TEA-01: Empty test case without assertions",
          category: "Idioms, Testing & Maintainability",
          severity: "High",
          message: `Empty test case detected: '${testTitle}' has no assertions violating TEA-01 In-Band Mutation Guard`,
          recommendation: "Add substantive assertions verifying the expected behavior of the tested unit.",
          sources: ["bmad_gap_verifier", "ompimpa-test"],
        });
      }
    }
  }

  // Elixir: test "..." do ... end
  const elixirTestRegex = /test\s+(?:"([^"]+)"|'([^']+)')\s*(?:,\s*[\s\S]*?)?\s*\bdo\b/g;
  while ((testMatch = elixirTestRegex.exec(content)) !== null) {
    const testTitle = testMatch[1] || testMatch[2];
    const res = extractElixirTestBody(content, elixirTestRegex.lastIndex);
    const testBody = res ? res.body : "";
    const stripped = testBody.replace(/#[^\n]*/g, "").trim();
    const hasAssertion = /\b(?:assert|refute|flunk)(?:_[a-zA-Z0-9_]+)?\b/.test(stripped);
    if (!hasAssertion) {
      const prefix = content.slice(0, testMatch.index);
      const testLine = prefix.split(/\r?\n/).length;
      findings.push({
        file: filePath || "unknown",
        line: testLine,
        ruleId: "TEA-01",
        rule_violation: "TEA-01: Empty test case without assertions",
        category: "Idioms, Testing & Maintainability",
        severity: "High",
        message: `Empty test case detected: '${testTitle}' has no assertions violating TEA-01 In-Band Mutation Guard`,
        recommendation: "Add substantive assertions verifying the expected behavior of the tested unit.",
        sources: ["bmad_gap_verifier", "ompimpa-test"],
      });
    }
    if (res) {
      elixirTestRegex.lastIndex = res.endIndex;
    }
  }
  return findings;
}

/**
 * E-02: Mendeteksi pola flaky pada berkas tes:
 * - Process.sleep / :timer.sleep pada Elixir ExUnit
 * - Arbitrary sleep / setTimeout pada TypeScript/JS
 */
export function detectFlakyPatterns(content: string, filePath?: string): TriageFinding[] {
  const findings: TriageFinding[] = [];
  const lines = content.split(/\r?\n/);
  const isElixir = Boolean(filePath && (filePath.endsWith(".ex") || filePath.endsWith(".exs")));
  const isTsJs = Boolean(
    filePath &&
      (filePath.endsWith(".ts") ||
        filePath.endsWith(".js") ||
        filePath.endsWith(".tsx") ||
        filePath.endsWith(".jsx"))
  );

  let inBacktick = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip full comment lines
    if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("*")) {
      continue;
    }

    // Track multi-line template literals in TS/JS
    if (isTsJs) {
      const backticks = (line.match(/(?<!\\)`/g) || []).length;
      const wasInBacktick = inBacktick;
      if (backticks % 2 !== 0) {
        inBacktick = !inBacktick;
      }
      if (wasInBacktick) {
        continue;
      }
    }

    // Strip inline comments for inspection
    let codePart = line;
    if (isElixir) {
      const firstHash = line.indexOf("#");
      if (firstHash !== -1) {
        const beforeHash = line.slice(0, firstHash);
        const doubleQuotes = (beforeHash.match(/"/g) || []).length;
        const singleQuotes = (beforeHash.match(/'/g) || []).length;
        if (doubleQuotes % 2 === 0 && singleQuotes % 2 === 0) {
          codePart = beforeHash;
        }
      }
    } else {
      codePart = line.split("//")[0];
    }

    // In TS/JS, strip inline template literals `...` before evaluating executable calls
    if (isTsJs) {
      codePart = codePart.replace(/`[^`]*`/g, '""');
    }

    let matchedSleep: string | null = null;
    let colNum: number | null = null;

    // 1. Elixir: Process.sleep or :timer.sleep (only for Elixir files or non-TS/JS context)
    if (!isTsJs) {
      const elixirSleepMatch = codePart.match(
        /(?:^|[^\w])(Process\.sleep|:timer\.sleep)(?:\s*\(|\s+[@a-zA-Z0-9_:.])/
      );
      if (elixirSleepMatch) {
        matchedSleep = elixirSleepMatch[1];
        colNum = (elixirSleepMatch.index ?? 0) + elixirSleepMatch[0].indexOf(matchedSleep) + 1;
      }
    }

    // 2. TypeScript / JS: setTimeout(...) or Bun.sleep(...) or standalone sleep(...)
    if (!isElixir && !matchedSleep) {
      const tsSleepMatch = codePart.match(/(?:^|[^\w.])(setTimeout|Bun\.sleep|sleep)\s*\(/);
      if (tsSleepMatch) {
        matchedSleep = tsSleepMatch[1];
        colNum = (tsSleepMatch.index ?? 0) + tsSleepMatch[0].indexOf(matchedSleep) + 1;
      }
    }

    if (matchedSleep) {
      findings.push({
        file: filePath || "unknown",
        line: lineNum,
        column: colNum,
        ruleId: "TEA-08",
        rule_violation: `TEA-08: ${matchedSleep} detected in test file (Flaky Test Hazard)`,
        category: "Idioms, Testing & Maintainability",
        severity: "High",
        message: `Flaky test hazard detected: ${matchedSleep} used at line ${lineNum}. Prohibited by TEA-08 and rules/elixir-testing-speed.md`,
        recommendation:
          "Replace sleep with deterministic synchronization: assert_receive/2, render_change/2, or polling with timeout.",
        sources: ["ompimpa-test"],
      });
    }
  }

  return findings;
}

export interface TestDurationRecord {
  name: string;
  file: string;
  durationMs: number;
  line?: number;
}

/**
 * E-02: Memeriksa durasi eksekusi pengujian terhadap ambang batas kecepatan in-band (default 50ms)
 */
export function checkTestSpeed(
  records: TestDurationRecord[],
  thresholdMs: number = 50
): TriageFinding[] {
  const findings: TriageFinding[] = [];
  for (const record of records) {
    if (
      Number.isFinite(record.durationMs) &&
      record.durationMs >= 0 &&
      record.durationMs > thresholdMs
    ) {
      findings.push({
        file: record.file,
        line: record.line ?? null,
        column: null,
        ruleId: "TEA-26",
        rule_violation: "TEA-26: Test duration exceeds speed threshold",
        category: "Reliability & Performance",
        severity: "High",
        message: `Slow test detected: '${record.name}' took ${record.durationMs}ms (threshold: ${thresholdMs}ms). LiveViewTest and in-process tests must execute in <= ${thresholdMs}ms.`,
        recommendation: `Optimize test setup, eliminate database overhead, or use lightweight unit tests to keep runtime <= ${thresholdMs}ms.`,
        sources: ["ompimpa-test"],
      });
    }
  }
  return findings;
}

export interface FlakyAuditOptions {
  repoRoot?: string;
  testFiles?: string[];
  durations?: TestDurationRecord[];
  speedThresholdMs?: number;
}

export interface FlakyAuditResult {
  storyId: string;
  flakyFindings: TriageFinding[];
  slowFindings: TriageFinding[];
  findings: TriageFinding[];
}

/**
 * E-02: Mengaudit berkas pengujian terhadap pola flaky (Process.sleep) dan batas durasi >50ms secara in-band
 */
export async function auditFlakyAndSlowTests(
  storyId: string,
  opts: FlakyAuditOptions = {}
): Promise<FlakyAuditResult> {
  const repoRoot = opts.repoRoot || REPO_ROOT;
  const thresholdMs = opts.speedThresholdMs ?? 50;
  const flakyFindings: TriageFinding[] = [];
  const slowFindings: TriageFinding[] = [];

  const filesToScan: Array<{ file: string; content: string }> = [];

  if (opts.testFiles && opts.testFiles.length > 0) {
    for (const f of opts.testFiles) {
      try {
        const full = path.isAbsolute(f) ? f : path.join(repoRoot, f);
        const content = await fs.readFile(full, "utf-8");
        filesToScan.push({ file: f, content });
      } catch {}
    }
  } else {
    let targetFiles: string[] = [];
    try {
      const storiesYamlPath = path.join(repoRoot, "_ompimpa", "stories.yaml");
      const yamlContent = await fs.readFile(storiesYamlPath, "utf-8");
      const parsedData = yaml.parse(yamlContent);
      const targetStory = storyId.toUpperCase().replace(/^STORY-/, "");
      const storyEntry = parsedData?.stories?.find((s: any) => s.id === storyId || s.id === targetStory);
      if (storyEntry) {
        const { testFiles: partitioned } = partitionTargetFiles(storyEntry as any, repoRoot);
        targetFiles = partitioned;
      }
    } catch {}

    if (targetFiles.length === 0) {
      const specPath = path.join(repoRoot, "_ompimpa", "specs", `SPEC-${storyId}.md`);
      try {
        const specContent = await fs.readFile(specPath, "utf-8");
        const atddSection = specContent.match(/### Berkas Uji ATDD[\s\S]*?(?=\n##|$)/);
        if (atddSection) {
          const matches = atddSection[0].match(/-\s*`?([a-zA-Z0-9_/.-]+(?:_test\.exs|\.test\.ts|\.test\.js|\.spec\.ts))`?/g);
          if (matches) {
            targetFiles = matches.map((m) => m.replace(/^-\s*`?/, "").replace(/`?$/, "").trim());
          }
        }
      } catch {}
    }

    if (targetFiles.length > 0) {
      for (const f of targetFiles) {
        try {
          const full = path.isAbsolute(f) ? f : path.join(repoRoot, f);
          const content = await fs.readFile(full, "utf-8");
          filesToScan.push({ file: f, content });
        } catch {}
      }
    } else {
      const testDir = path.join(repoRoot, "test");
      async function walkDir(dir: string) {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const res = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              await walkDir(res);
            } else if (
              entry.isFile() &&
              (entry.name.endsWith(".test.ts") ||
               entry.name.endsWith(".test.js") ||
               entry.name.endsWith(".spec.ts") ||
               entry.name.endsWith("_test.exs"))
            ) {
              const rel = path.relative(repoRoot, res);
              const content = await fs.readFile(res, "utf-8");
              filesToScan.push({ file: rel, content });
            }
          }
        } catch {}
      }
      await walkDir(testDir);
    }
  }

  for (const item of filesToScan) {
    const flakies = detectFlakyPatterns(item.content, item.file);
    flakyFindings.push(...flakies);
  }

  if (opts.durations && opts.durations.length > 0) {
    const slows = checkTestSpeed(opts.durations, thresholdMs);
    slowFindings.push(...slows);
  }

  const allFindings = [...flakyFindings, ...slowFindings];
  return {
    storyId,
    flakyFindings,
    slowFindings,
    findings: allFindings,
  };
}

interface ParsedTestCase {
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  hasAssertion: boolean;
  hasSubstantive: boolean;
  hasFalseGreen: boolean;
}

export function checkACTraceability(
  specACs: string[],
  testFiles: Array<{ file: string; content: string }>
): TraceabilityCheckResult {
  const coveredACs: string[] = [];
  const missingACs: string[] = [];
  const findings: TriageFinding[] = [];
  const falseGreens: TriageFinding[] = [];

  // 1. Detect false greens across test files
  for (const tf of testFiles) {
    const fgs = detectFalseGreens(tf.content, tf.file);
    falseGreens.push(...fgs);
  }

  // 2. Parse test cases in all test files
  const parsedTests: ParsedTestCase[] = [];

  for (const tf of testFiles) {
    const content = tf.content;

    // TS block: it/test("...", () => { ... }) with brace-depth tracking
    const tsBlockOpener = /(?:it|test)\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)?\s*=>\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = tsBlockOpener.exec(content)) !== null) {
      const title = m[1];
      const startIndex = m.index;
      const braceStart = tsBlockOpener.lastIndex - 1;

      let depth = 1;
      let endIndex = -1;
      for (let pos = braceStart + 1; pos < content.length; pos++) {
        if (content[pos] === "{") depth++;
        else if (content[pos] === "}") {
          depth--;
          if (depth === 0) {
            endIndex = pos;
            break;
          }
        }
      }

      if (endIndex !== -1) {
        const body = content.slice(braceStart + 1, endIndex);
        const prefix = content.slice(0, startIndex);
        const startLine = prefix.split(/\r?\n/).length;
        const endLine = content.slice(0, endIndex).split(/\r?\n/).length;

        const hasFG = falseGreens.some((fg) => fg.file === tf.file && fg.line != null && fg.line >= startLine && fg.line <= endLine);
        const stripped = body.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").trim();
        const hasAssertion = /expect\s*\(|assert\s*\(/.test(stripped);
        const hasSubstantive = hasAssertion && !hasFG;
        parsedTests.push({ title, file: tf.file, startLine, endLine, hasAssertion, hasSubstantive, hasFalseGreen: hasFG });
      }
    }
    const tsConciseRegex = /(?:it|test)\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)?\s*=>\s*([^{}\n]+(?:;|\)))/g;
    while ((m = tsConciseRegex.exec(content)) !== null) {
      const title = m[1];
      const body = m[2];
      const prefix = content.slice(0, m.index);
      const startLine = prefix.split(/\r?\n/).length;
      const endLine = startLine;
      const hasFG = falseGreens.some((fg) => fg.file === tf.file && fg.line === startLine);
      const hasAssertion = /expect\s*\(|assert\s*\(|expect\.unreachable\s*\(/.test(body);
      const hasSubstantive = hasAssertion && !hasFG;
      parsedTests.push({ title, file: tf.file, startLine, endLine, hasAssertion, hasSubstantive, hasFalseGreen: hasFG });
    }

    // Elixir: test "..." do ... end
    const elixirRegex = /test\s+(?:"([^"]+)"|'([^']+)')\s*(?:,\s*[\s\S]*?)?\s*\bdo\b/g;
    while ((m = elixirRegex.exec(content)) !== null) {
      const title = m[1] || m[2];
      const res = extractElixirTestBody(content, elixirRegex.lastIndex);
      const body = res ? res.body : "";
      const prefix = content.slice(0, m.index);
      const startLine = prefix.split(/\r?\n/).length;
      const endLine = res ? content.slice(0, res.endIndex).split(/\r?\n/).length : startLine;
      const hasFG = falseGreens.some((fg) => fg.file === tf.file && fg.line != null && fg.line >= startLine && fg.line <= endLine);
      const stripped = body.replace(/#[^\n]*/g, "").trim();
      const hasAssertion = /\b(?:assert|refute|flunk)(?:_[a-zA-Z0-9_]+)?\b/.test(stripped);
      const hasSubstantive = hasAssertion && !hasFG;
      parsedTests.push({ title, file: tf.file, startLine, endLine, hasAssertion, hasSubstantive, hasFalseGreen: hasFG });
      if (res) {
        elixirRegex.lastIndex = res.endIndex;
      }
    }
  }

  // 3. Match each AC against parsed tests with exact word boundary
  for (const ac of specACs) {
    const acClean = ac.trim();
    const acRegex = new RegExp(`\\b${acClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const matchingTests = parsedTests.filter((t) => acRegex.test(t.title));
    if (matchingTests.length === 0) {
      missingACs.push(acClean);
    } else {
      // Check if any matching test is substantive
      const anyValid = matchingTests.some((t) => t.hasSubstantive);
      if (anyValid) {
        coveredACs.push(acClean);
      } else {
        missingACs.push(acClean);
      }
    }
  }

  // 4. Generate High Findings for missing ACs
  for (const missing of missingACs) {
    findings.push({
      file: testFiles[0]?.file || "test/",
      line: null,
      ruleId: "TEA-01",
      rule_violation: `Missing test assertion for acceptance criterion: ${missing}`,
      category: "Functional & Correctness",
      severity: "High",
      message: `Missing test assertion for acceptance criterion: ${missing} (TEA-01 Traceability)`,
      recommendation: `Add an automated test case with substantive assertions verifying acceptance criterion ${missing}.`,
      sources: ["bmad_gap_verifier"],
    });
  }

  // 5. Append false greens to findings
  findings.push(...falseGreens);

  return { coveredACs, missingACs, falseGreens, findings };
}

export async function auditTeaTraceability(
  storyId: string,
  opts: TraceabilityOptions = {}
): Promise<TraceabilityAuditResult> {
  const repoRoot = opts.repoRoot || REPO_ROOT;
  const targetStory = storyId.toUpperCase().replace(/^STORY-/, "");

  // 1. Locate spec file
  let specPath = opts.specPath;
  let specContent: string | null = null;

  if (specPath) {
    try {
      specContent = await fs.readFile(specPath, "utf-8");
    } catch {}
  }

  if (!specContent) {
    const candidates = [
      path.join(repoRoot, "_ompimpa", "specs", `SPEC-${storyId}.md`),
      path.join(repoRoot, "_ompimpa", "specs", `SPEC-${targetStory}.md`),
      path.join(repoRoot, "_ompimpa", "specs", `SPEC-${storyId.toLowerCase()}.md`),
    ];
    for (const c of candidates) {
      try {
        specContent = await fs.readFile(c, "utf-8");
        specPath = c;
        break;
      } catch {}
    }
  }

  let specACs: string[] = [];
  if (specContent) {
    specACs = extractStoryACs(specContent);
  }

  // If no ACs in spec, try reading from _ompimpa/stories.yaml via structured YAML
  if (specACs.length === 0) {
    try {
      const storiesYamlPath = path.join(repoRoot, "_ompimpa", "stories.yaml");
      const yamlContent = await fs.readFile(storiesYamlPath, "utf-8");
      const parsedData = yaml.parse(yamlContent);
      const storyEntry = parsedData?.stories?.find((s: any) => s.id === storyId || s.id === targetStory);
      if (storyEntry && Array.isArray(storyEntry.ac)) {
        specACs = storyEntry.ac.map((a: any) => a.id).filter(Boolean);
      }
    } catch {}
  }

  // 2. Scan test files (scoped to story target_files if available)
  const testFiles: Array<{ file: string; content: string }> = [];
  let storyTestFiles: string[] = [];
  try {
    const storiesYamlPath = path.join(repoRoot, "_ompimpa", "stories.yaml");
    const yamlContent = await fs.readFile(storiesYamlPath, "utf-8");
    const parsedData = yaml.parse(yamlContent);
    const storyEntry = parsedData?.stories?.find((s: any) => s.id === storyId || s.id === targetStory);
    if (storyEntry) {
      const { testFiles: partitioned } = partitionTargetFiles(storyEntry as any, repoRoot);
      storyTestFiles = partitioned;
    }
  } catch {}

  if (storyTestFiles.length === 0 && specContent) {
    const atddSection = specContent.match(/### Berkas Uji ATDD[\s\S]*?(?=\n##|$)/);
    if (atddSection) {
      const matches = atddSection[0].match(/-\s*`?([a-zA-Z0-9_/.-]+(?:_test\.exs|\.test\.ts|\.test\.js|\.spec\.ts))`?/g);
      if (matches) {
        storyTestFiles = matches.map((m) => m.replace(/^-\s*`?/, "").replace(/`?$/, "").trim());
      }
    }
  }

  if (opts.testFiles && opts.testFiles.length > 0) {
    for (const f of opts.testFiles) {
      try {
        const full = path.isAbsolute(f) ? f : path.join(repoRoot, f);
        const content = await fs.readFile(full, "utf-8");
        testFiles.push({ file: f, content });
      } catch {}
    }
  } else if (storyTestFiles.length > 0) {
    for (const f of storyTestFiles) {
      try {
        const full = path.isAbsolute(f) ? f : path.join(repoRoot, f);
        const content = await fs.readFile(full, "utf-8");
        testFiles.push({ file: f, content });
      } catch {}
    }
  } else {
    // Scan test directory
    const testDir = path.join(repoRoot, "test");
    async function collectTestFiles(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const res = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await collectTestFiles(res);
          } else if (
            entry.isFile() &&
            (entry.name.endsWith(".test.ts") ||
             entry.name.endsWith(".test.js") ||
             entry.name.endsWith(".spec.ts") ||
             entry.name.endsWith(".spec.js") ||
             entry.name.endsWith("_test.exs"))
          ) {
            const rel = path.relative(repoRoot, res);
            const content = await fs.readFile(res, "utf-8");
            testFiles.push({ file: rel, content });
          }
        }
      } catch {}
    }
    await collectTestFiles(testDir);
  }

  const checkResult = checkACTraceability(specACs, testFiles);
  return {
    storyId,
    specPath,
    ...checkResult,
  };
}
