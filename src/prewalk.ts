import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface PrewalkRule {
  id: string;
  name: string;
  description: string;
  globs: string[];
  patterns: RegExp[];
  severity: "error" | "warning" | "blocker";
  remediation?: string;
}

export interface PrewalkFinding {
  file: string;
  line: number;
  column: number;
  matchedText: string;
  ruleId: string;
  ruleName: string;
  description: string;
  severity: "error" | "warning" | "blocker";
  remediation?: string;
}

export interface PrewalkScanResult {
  passed: boolean;
  totalFiles: number;
  scannedRules: number;
  findings: PrewalkFinding[];
}

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/**
 * Membaca dan mem-parsing seluruh aturan TTSR di folder rules/
 */
export async function loadPrewalkRules(rulesDir: string = path.join(REPO_ROOT, "rules")): Promise<PrewalkRule[]> {
  const rules: PrewalkRule[] = [];

  try {
    const files = await fs.readdir(rulesDir);
    const modularRuleFiles = files.filter(
      (f) => f.startsWith("elixir-") && f.endsWith(".md") && !f.includes("iron-laws")
    );

    for (const file of modularRuleFiles) {
      const filePath = path.join(rulesDir, file);
      const content = await fs.readFile(filePath, "utf-8");

      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) continue;

      const frontmatter = frontmatterMatch[1];
      const descMatch = frontmatter.match(/description:\s*["']?([^"'\n]+)["']?/);
      const description = descMatch ? descMatch[1].trim() : file;

      // Extract globs
      const globsMatch = frontmatter.match(/globs:\s*\[(.*?)\]/);
      const globs = globsMatch
        ? globsMatch[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
        : ["*.ex", "*.exs"];

      // Extract conditions / regex patterns
      const patterns: RegExp[] = [];
      const conditionBlockMatch = frontmatter.match(/condition:\s*\n((?:\s*-\s*.*(?:\n|$))+)/);
      if (conditionBlockMatch) {
        const lines = conditionBlockMatch[1].split("\n").filter((l) => l.trim().startsWith("-"));
        for (const line of lines) {
          const rawPattern = line.replace(/^\s*-\s*/, "").trim().replace(/^['"]|['"]$/g, "");
          try {
            patterns.push(new RegExp(rawPattern, "m"));
          } catch {
            // Ignore invalid regex
          }
        }
      }

      // Extract remediation summary
      let remediation: string | undefined;
      const solutionMatch = content.match(/### Solusi Wajib:([\s\S]*?)(?=\n##|\n#|$)/);
      if (solutionMatch) {
        remediation = solutionMatch[1].trim().split("\n")[0].replace(/^\d+\.\s*/, "");
      }

      const ruleId = file.replace(/\.md$/, "");
      const ruleName = ruleId
        .replace(/^elixir-/, "")
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");

      rules.push({
        id: ruleId,
        name: ruleName,
        description,
        globs,
        patterns,
        severity: "blocker",
        remediation,
      });
    }
  } catch {
    // Fallback gracefully
  }

  return rules;
}

/**
 * Memindai konten satu file Elixir terhadap sekumpulan aturan Prewalk
 */
export function scanCode(
  code: string,
  filePath: string,
  rules: PrewalkRule[]
): PrewalkFinding[] {
  const findings: PrewalkFinding[] = [];

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(code);
      if (match && match.index !== undefined) {
        // Hitung baris dan kolom 1-indexed
        const textBefore = code.slice(0, match.index);
        const lines = textBefore.split("\n");
        const lineNumber = lines.length;
        const columnNumber = lines[lines.length - 1].length + 1;

        findings.push({
          file: filePath,
          line: lineNumber,
          column: columnNumber,
          matchedText: match[0].trim(),
          ruleId: rule.id,
          ruleName: rule.name,
          description: rule.description,
          severity: rule.severity,
          remediation: rule.remediation,
        });
      }
    }
  }

  return findings;
}

/**
 * Memindai direktori target (misal lib/ dan test/) atau file spesifik
 */
export async function runPrewalkScan(
  targetDir: string = process.cwd(),
  options: {
    rulesDir?: string;
    targetPaths?: string[];
  } = {}
): Promise<PrewalkScanResult> {
  const rules = await loadPrewalkRules(options.rulesDir);
  const findings: PrewalkFinding[] = [];
  let totalFiles = 0;

  async function walk(dirPath: string) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          // Abaikan folder build, deps, git, _ompimpa, node_modules
          if (
            ["_build", "deps", ".git", "_ompimpa", "node_modules", "assets"].includes(
              entry.name
            )
          ) {
            continue;
          }
          await walk(fullPath);
        } else if (entry.isFile()) {
          if (entry.name.endsWith(".ex") || entry.name.endsWith(".exs")) {
            totalFiles++;
            const relativePath = path.relative(targetDir, fullPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const fileFindings = scanCode(content, relativePath, rules);
            findings.push(...fileFindings);
          }
        }
      }
    } catch {
      // Folder might not exist yet
    }
  }

  if (options.targetPaths && options.targetPaths.length > 0) {
    for (const p of options.targetPaths) {
      const fullPath = path.isAbsolute(p) ? p : path.join(targetDir, p);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await walk(fullPath);
        } else if (stat.isFile() && (p.endsWith(".ex") || p.endsWith(".exs"))) {
          totalFiles++;
          const relativePath = path.relative(targetDir, fullPath);
          const content = await fs.readFile(fullPath, "utf-8");
          findings.push(...scanCode(content, relativePath, rules));
        }
      } catch {
        // ignore missing path
      }
    }
  } else {
    // Default: Scan lib/ dan test/ jika ada, atau seluruh targetDir
    const libDir = path.join(targetDir, "lib");
    const testDir = path.join(targetDir, "test");
    const hasLib = await fs.stat(libDir).then(() => true).catch(() => false);
    const hasTest = await fs.stat(testDir).then(() => true).catch(() => false);

    if (hasLib) await walk(libDir);
    if (hasTest) await walk(testDir);
    if (!hasLib && !hasTest) await walk(targetDir);
  }

  return {
    passed: findings.length === 0,
    totalFiles,
    scannedRules: rules.length,
    findings,
  };
}
