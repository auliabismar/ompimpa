import { spawn, type ChildProcess } from "node:child_process";
import type { TriageFinding } from "./triage";

export type ContestedReason =
  | "severity-clash"
  | "maybe-false"
  | "remediation-conflict"
  | "boundary-dispute";

export interface ContestedGroup {
  key: string;
  file: string;
  line: number | null;
  findings: TriageFinding[];
  reason: ContestedReason;
}

export interface AdjudicationVerdict {
  finding_key: string;
  final_severity: "Critical" | "High" | "Medium" | "Low" | "P0" | "P1" | "P2";
  final_verdict: "high" | "medium" | "low" | "false" | "maybe-false";
  consensus_remediation: string;
}

const STATUTORY_RULE_PATTERN = /^(01-|02-|03-|04-|05-|07-|13-|14-|17-|IL-|SEC-|CREDO-)/i;

function severityWeight(sev: string): number {
  const s = (sev || "").toLowerCase();
  if (s === "critical" || s === "p0") return 30;
  if (s === "high" || s === "p1") return 15;
  if (s === "medium" || s === "p2-medium") return 5;
  if (s === "low" || s === "p2" || s === "p2-low") return 2;
  return 5;
}

function isStatutoryFinding(f: TriageFinding): boolean {
  if (f.ruleId && STATUTORY_RULE_PATTERN.test(f.ruleId)) {
    return true;
  }
  const isIronLaw = (f.category || "").toLowerCase() === "ironlaw";
  const isCritOrP0 = (f.severity || "").toLowerCase() === "critical" || (f.severity || "").toLowerCase() === "p0";
  if (isIronLaw && isCritOrP0) {
    return true;
  }
  return false;
}

const CONFLICT_PAIRS: Array<[RegExp, RegExp]> = [
  [/\bash\b/i, /\becto\b/i],
  [/Ash\.Query/i, /Ecto\.Multi/i],
  [/\bstream\b/i, /\bassign\b/i],
];

const TECH_SOURCES = ["ompimpa-ecto", "ompimpa-ash", "ompimpa-liveview", "ompimpa-oban"];

/**
 * Aturan detectContestedFindings (deterministik, 0-token):
 * Input adalah output deduplicateFindings().
 * (a) lewati grup statutori kaku: ruleId cocok /^(01-|02-|03-|04-|05-|07-|13-|14-|17-|IL-|SEC-|CREDO-)/i
 *     atau category==="IronLaw" dengan severity Critical/P0 — jangan pernah eskalasi.
 * (b) kelompokkan sisa by `${file}:${line ?? ""}`:
 *     grup dengan ≥2 finding dan selisih severityWeight ≥13 (misal Critical 30 vs Low 2) → severity-clash.
 * (c) finding tunggal dengan (verdict||"").toLowerCase()==="maybe-false" → maybe-false.
 * (d) grup yang pesan message+recommendation mengandung pasangan kontradiktif (ash vs ecto, Ash.Query vs Ecto.Multi, stream vs assign) → remediation-conflict.
 * (e) grup dengan sumber bmad_structural + salah satu tech (ompimpa-ecto|ompimpa-ash|ompimpa-liveview|ompimpa-oban) pada file sama → boundary-dispute.
 * Key grup = `${file}:${line ?? "global"}:${reason}`. Kosong → tidak ada sengketa.
 */
export function detectContestedFindings(deduped: TriageFinding[]): ContestedGroup[] {
  const groups: ContestedGroup[] = [];

  // Filter out strict statutory findings
  const eligible = deduped.filter((f) => !isStatutoryFinding(f));
  if (eligible.length === 0) {
    return [];
  }

  // (c) Check single findings with verdict === "maybe-false"
  for (const f of eligible) {
    const v = (f.verdict || "").toLowerCase();
    if (v === "maybe-false") {
      const file = f.file || "global";
      const line = f.line ?? null;
      const lineStr = line == null ? "global" : String(line);
      const reason: ContestedReason = "maybe-false";
      const key = `${file}:${lineStr}:${reason}`;
      groups.push({
        key,
        file,
        line,
        findings: [f],
        reason,
      });
    }
  }

  // Group remaining by `${file}:${line ?? ""}`
  const byLocation = new Map<string, { file: string; line: number | null; findings: TriageFinding[] }>();
  for (const f of eligible) {
    const file = f.file || "global";
    const line = f.line ?? null;
    const locKey = `${file}:${line ?? ""}`;
    const entry = byLocation.get(locKey);
    if (!entry) {
      byLocation.set(locKey, { file, line, findings: [f] });
    } else {
      entry.findings.push(f);
    }
  }

  // Group by file for boundary-dispute check
  const byFile = new Map<string, TriageFinding[]>();
  for (const f of eligible) {
    const file = f.file || "global";
    const list = byFile.get(file) || [];
    list.push(f);
    byFile.set(file, list);
  }

  for (const [, locGroup] of byLocation) {
    const { file, line, findings } = locGroup;
    const lineStr = line == null ? "global" : String(line);

    // (b) grup dengan ≥2 finding dan selisih severityWeight ≥13
    if (findings.length >= 2) {
      let minWeight = Infinity;
      let maxWeight = -Infinity;
      for (const f of findings) {
        const w = severityWeight(f.severity);
        if (w < minWeight) minWeight = w;
        if (w > maxWeight) maxWeight = w;
      }
      if (maxWeight - minWeight >= 13) {
        const reason: ContestedReason = "severity-clash";
        const key = `${file}:${lineStr}:${reason}`;
        groups.push({
          key,
          file,
          line,
          findings: [...findings],
          reason,
        });
      }

      // (d) pesan message+recommendation mengandung pasangan kontradiktif
      const combinedTexts = findings.map(
        (f) => `${f.message || ""} ${f.recommendation || ""} ${f.remediation || ""}`
      );
      let hasRemediationConflict = false;
      for (const [patA, patB] of CONFLICT_PAIRS) {
        let hasA = false;
        let hasB = false;
        for (const text of combinedTexts) {
          if (patA.test(text)) hasA = true;
          if (patB.test(text)) hasB = true;
        }
        if (hasA && hasB) {
          hasRemediationConflict = true;
          break;
        }
      }
      if (hasRemediationConflict) {
        const reason: ContestedReason = "remediation-conflict";
        const key = `${file}:${lineStr}:${reason}`;
        groups.push({
          key,
          file,
          line,
          findings: [...findings],
          reason,
        });
      }
    }
  }

  // (e) grup dengan sumber bmad_structural + salah satu tech pada file sama → boundary-dispute
  for (const [file, fileFindings] of byFile) {
    if (fileFindings.length < 2) continue;
    const hasBmadStructural = fileFindings.some((f) =>
      (f.sources || []).some((s) => s.includes("bmad_structural") || s.includes("structural"))
    );
    const hasTech = fileFindings.some((f) =>
      (f.sources || []).some((s) => TECH_SOURCES.some((ts) => s.includes(ts)))
    );
    if (hasBmadStructural && hasTech) {
      const reason: ContestedReason = "boundary-dispute";
      const key = `${file}:global:${reason}`;
      groups.push({
        key,
        file,
        line: null,
        findings: [...fileFindings],
        reason,
      });
    }
  }

  // Deduplicate groups by key
  const uniqueGroups = new Map<string, ContestedGroup>();
  for (const g of groups) {
    if (!uniqueGroups.has(g.key)) {
      uniqueGroups.set(g.key, g);
    }
  }

  return Array.from(uniqueGroups.values());
}

/**
 * buildMiniBalairungPrompt hasilkan satu string berisi:
 * - peran arbiter,
 * - daftar grup (maks 8 grup; jika lebih, potong 8 pertama dan catat truncated),
 * - tiap finding (file:line, ruleId, severity awal, verdict, evidence 1-2 kalimat),
 * - dan instruksi output JSON array AdjudicationVerdict[] saja.
 */
export function buildMiniBalairungPrompt(groups: ContestedGroup[], storyId: string): string {
  const maxGroups = 8;
  const isTruncated = groups.length > maxGroups;
  const slicedGroups = groups.slice(0, maxGroups);

  const groupsText = slicedGroups
    .map((g, idx) => {
      const header = `### Sengketa ${idx + 1}: ${g.key} (Alasan: ${g.reason})`;
      const findingsText = g.findings
        .map((f) => {
          const loc = `${f.file || "global"}${f.line != null ? `:${f.line}` : ""}`;
          const rule = f.ruleId;
          const sev = f.severity;
          const verd = f.verdict || "unspecified";
          const evid = f.evidence || f.message || f.recommendation || "Tidak ada bukti tambahan.";
          const candidateKey = `${loc}:${rule}`;
          return `- finding_key: "${g.key}" atau "${candidateKey}" | File:Line: ${loc} | RuleId: ${rule} | Severity: ${sev} | Verdict: ${verd} | Evidence: ${evid}`;
        })
        .join("\n");
      return `${header}\n${findingsText}`;
    })
    .join("\n\n");

  const truncatedNotice = isTruncated
    ? `\n\n[Catatan: Daftar sengketa dipotong (truncated) ke 8 grup pertama dari total ${groups.length} grup.]\n`
    : "";

  return `Anda adalah Hakim Adjudikasi Mini Balairung (Tier 2.5) OMP-IMPA untuk Story ${storyId}.
Tugas Anda adalah menyelesaikan sengketa hasil review (severity-clash, maybe-false, remediation-conflict, atau boundary-dispute) secara objektif, berimbang, dan adil.

Daftar Sengketa Temuan:${truncatedNotice}
${groupsText}

INSTRUKSI PENILAIAN & OUTPUT:
1. Analisis setiap sengketa. Tentukan keparahan final (final_severity), vonis final (final_verdict: "high"|"medium"|"low"|"false"|"maybe-false"), dan konsensus perbaikan (consensus_remediation).
2. Jika temuan terbukti false positive / tidak valid, berikan final_verdict: "false".
3. Output WAJIB berupa JSON array valid tanpa teks pengantar, markdown penjelasan tambahan, atau blok pembuka di luar JSON.
Contoh format output:
[
  {
    "finding_key": "lib/my_app/user.ex:42:severity-clash",
    "final_severity": "Medium",
    "final_verdict": "medium",
    "consensus_remediation": "Perbaiki skema tanpa memicu crash runtime."
  }
]
`;
}

const VALID_SEVERITIES = new Set(["Critical", "High", "Medium", "Low", "P0", "P1", "P2"]);
const VALID_VERDICTS = new Set(["high", "medium", "low", "false", "maybe-false"]);

/**
 * applyAdjudicationResults:
 * cocokkan finding_key ke key grup (atau file:line:ruleId asal);
 * jika final_verdict==="false" tandai finding verdict="false" agar aggregateReviews memindahkannya ke rejected;
 * selain itu timpa severity=final_severity, verdict=final_verdict, remediation=consensus_remediation.
 * Verdict tak dikenal → abaikan entri itu (pertahankan finding asal).
 */
export function applyAdjudicationResults(
  deduped: TriageFinding[],
  verdicts: AdjudicationVerdict[]
): TriageFinding[] {
  if (!verdicts || !Array.isArray(verdicts) || verdicts.length === 0) {
    return deduped;
  }

  // Create lookup map for valid verdicts
  // Keys can match group key or `${file}:${line ?? ""}:${ruleId}` or `${file}:${ruleId}`
  const validVerdicts = verdicts.filter(
    (v) =>
      v &&
      typeof v.finding_key === "string" &&
      VALID_SEVERITIES.has(v.final_severity) &&
      VALID_VERDICTS.has(v.final_verdict)
  );

  if (validVerdicts.length === 0) {
    return deduped;
  }

  return deduped.map((finding) => {
    const file = finding.file || "global";
    const lineStr = finding.line != null ? String(finding.line) : "";
    const locRuleKey = lineStr ? `${file}:${lineStr}:${finding.ruleId}` : `${file}:${finding.ruleId}`;

    // Find matching verdict:
    // Match by locRuleKey exact match, OR group key prefix match (`${file}:${lineStr || "global"}:`)
    const matched = validVerdicts.find((v) => {
      if (v.finding_key === locRuleKey) return true;
      if (v.finding_key === `${file}:${finding.ruleId}`) return true;
      // Match group key format: `${file}:${line ?? "global"}:${reason}`
      const groupPrefix = `${file}:${lineStr || "global"}:`;
      if (v.finding_key.startsWith(groupPrefix)) return true;
      // Or exact group key equality
      if (v.finding_key === `${file}:global:boundary-dispute`) return true;
      return false;
    });

    if (!matched) {
      return finding;
    }

    if (matched.final_verdict === "false") {
      return {
        ...finding,
        verdict: "false",
        remediation: matched.consensus_remediation || finding.remediation,
      };
    }

    return {
      ...finding,
      severity: matched.final_severity,
      verdict: matched.final_verdict,
      remediation: matched.consensus_remediation || finding.remediation,
    };
  });
}

export interface AdjudicationOptions {
  model?: string;
  timeoutMs?: number;
  targetDir?: string;
  executor?: (
    cmd: string,
    args: string[],
    cwd: string,
    timeoutMs: number
  ) => Promise<{ code: number; stdout: string; stderr: string }>;
}

export interface AdjudicationTaskResult {
  success: boolean;
  verdicts: AdjudicationVerdict[];
  reason?: string;
}

export function parseAdjudicationVerdicts(rawOutput: string): AdjudicationVerdict[] | null {
  if (!rawOutput || typeof rawOutput !== "string") return null;

  let text = rawOutput.trim();

  // Try extracting assistant text if rawOutput is from omp JSON-mode lines
  if (text.startsWith("{") || text.includes('"type":"')) {
    const lines = text.split("\n");
    let extractedAssistantText = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        if (obj.type === "message_end" && obj.message?.role === "assistant") {
          const contents = obj.message?.content || [];
          for (const c of contents) {
            if (c.type === "text" && typeof c.text === "string") {
              extractedAssistantText = c.text;
            }
          }
        } else if (obj.type === "agent_end" && Array.isArray(obj.messages)) {
          for (const m of obj.messages) {
            if (m.role === "assistant" && Array.isArray(m.content)) {
              for (const c of m.content) {
                if (c.type === "text" && typeof c.text === "string") {
                  extractedAssistantText = c.text;
                }
              }
            }
          }
        }
      } catch {
        // not a json line
      }
    }
    if (extractedAssistantText) {
      text = extractedAssistantText.trim();
    }
  }

  // Remove markdown code fences if any
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // Find array boundaries
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    text = text.substring(firstBracket, lastBracket + 1);
  }

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    const validated: AdjudicationVerdict[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.finding_key === "string" &&
        VALID_SEVERITIES.has(item.final_severity) &&
        VALID_VERDICTS.has(item.final_verdict)
      ) {
        validated.push({
          finding_key: item.finding_key,
          final_severity: item.final_severity,
          final_verdict: item.final_verdict,
          consensus_remediation:
            typeof item.consensus_remediation === "string"
              ? item.consensus_remediation
              : "",
        });
      } else {
        // Invalid item in array
        return null;
      }
    }
    return validated.length > 0 ? validated : null;
  } catch {
    return null;
  }
}

export async function runAdjudicationTask(
  groups: ContestedGroup[],
  storyId: string,
  options: AdjudicationOptions = {}
): Promise<AdjudicationTaskResult> {
  if (groups.length === 0) {
    return { success: true, verdicts: [] };
  }

  // Support mock adjudication via env for unit testing or testing environments
  if (process.env.OMPIMPA_MOCK_ADJUDICATION) {
    const mockParsed = parseAdjudicationVerdicts(process.env.OMPIMPA_MOCK_ADJUDICATION);
    if (mockParsed) {
      return { success: true, verdicts: mockParsed };
    }
    return {
      success: false,
      verdicts: [],
      reason: "invalid OMPIMPA_MOCK_ADJUDICATION format",
    };
  }

  const prompt = buildMiniBalairungPrompt(groups, storyId);
  const model = options.model || "smol";
  const timeoutMs = options.timeoutMs ?? 30000;
  const targetDir = options.targetDir || process.cwd();

  const cmd = "omp";
  const args = [
    "-p",
    "--mode",
    "json",
    "--model",
    model,
    "--no-tools",
    "--thinking",
    "off",
    "--no-session",
    prompt,
  ];

  let stdout = "";
  let stderr = "";

  if (options.executor) {
    try {
      const res = await options.executor(cmd, args, targetDir, timeoutMs);
      stdout = res.stdout;
      stderr = res.stderr;
      if (res.code !== 0) {
        return {
          success: false,
          verdicts: [],
          reason: `executor exited with code ${res.code}: ${stderr.slice(0, 200)}`,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        verdicts: [],
        reason: `executor failed: ${msg}`,
      };
    }
  } else {
    try {
      const res = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        let childProc: ChildProcess;
        try {
          childProc = spawn(cmd, args, {
            cwd: targetDir,
            stdio: ["ignore", "pipe", "pipe"],
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return resolve({ code: 1, stdout: "", stderr: `Spawn error: ${msg}` });
        }

        let childStdout = "";
        let childStderr = "";
        let settled = false;

        const settle = (result: { code: number; stdout: string; stderr: string }) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result);
        };

        const timer = setTimeout(() => {
          try {
            childProc.kill("SIGTERM");
            setTimeout(() => {
              try {
                childProc.kill("SIGKILL");
              } catch {
                // ignore
              }
            }, 1000);
          } catch {
            // ignore
          }
          settle({ code: 124, stdout: childStdout, stderr: "adjudication timeout exceeded" });
        }, timeoutMs);

        childProc.stdout?.on("data", (chunk: Buffer) => {
          childStdout += chunk.toString("utf-8");
        });
        childProc.stderr?.on("data", (chunk: Buffer) => {
          childStderr += chunk.toString("utf-8");
        });

        childProc.on("error", (err: Error) => {
          settle({ code: 1, stdout: childStdout, stderr: `Process error: ${err.message}` });
        });

        childProc.on("close", (code: number | null) => {
          settle({ code: code ?? 0, stdout: childStdout, stderr: childStderr });
        });
      });

      if (res.code === 124) {
        return { success: false, verdicts: [], reason: `timeout after ${timeoutMs}ms` };
      }
      if (res.code !== 0) {
        return {
          success: false,
          verdicts: [],
          reason: `process exited with code ${res.code}: ${res.stderr.slice(0, 200)}`,
        };
      }
      stdout = res.stdout;
      stderr = res.stderr;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, verdicts: [], reason: `subagent execution error: ${msg}` };
    }
  }

  const parsedVerdicts = parseAdjudicationVerdicts(stdout);
  if (!parsedVerdicts || parsedVerdicts.length === 0) {
    return {
      success: false,
      verdicts: [],
      reason: "invalid or empty JSON output from adjudicator",
    };
  }

  return { success: true, verdicts: parsedVerdicts };
}
