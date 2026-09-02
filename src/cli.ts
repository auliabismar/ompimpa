import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { parseToml, type OmpimpaModelsConfig } from "../hooks/ompimpa-guard";
import {
  runPrewalkScan,
  type PrewalkScanResult,
  parseStoriesYaml,
  checkCircularDAG,
  parseFeatureStatusYaml,
  getBlockedStory,
} from "./prewalk";
import { runReview, type ReviewResult } from "./reviewer";
const VERSION = "1.0.0";
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

export const DEFAULT_MODELS: Record<string, string> = {
  "ompimpa-balairung": "slow",
  "ompimpa-ideate": "slow",
  "ompimpa-prd": "plan",
  "ompimpa-adr": "plan",
  "ompimpa-ui": "design",
  "ompimpa-test": "default",
  "ompimpa-dev": "default",
  "ompimpa-ash": "default",
  "ompimpa-liveview": "default",
  "ompimpa-ecto": "default",
  "ompimpa-oban": "default",
  "ompimpa-otp": "default",
  "ompimpa-doc": "default",
  "ompimpa-commit": "smol",
  "ompimpa-ironlaw": "smol",
  "ompimpa-security": "slow",
  "ompimpa-debug": "slow",
  "ompimpa-triz": "slow",
};

export function resolveAgentModel(agentName: string, modelsConfig?: OmpimpaModelsConfig): string {
  if (!modelsConfig) return DEFAULT_MODELS[agentName] || "default";

  if (agentName === "ompimpa-balairung" && modelsConfig.balairung) return modelsConfig.balairung;
  if (agentName === "ompimpa-ideate" && modelsConfig.ideate) return modelsConfig.ideate;
  if (agentName === "ompimpa-prd" && modelsConfig.prd) return modelsConfig.prd;
  if (agentName === "ompimpa-adr" && modelsConfig.adr) return modelsConfig.adr;
  if (agentName === "ompimpa-ui" && modelsConfig.ui) return modelsConfig.ui;
  if (agentName === "ompimpa-test" && modelsConfig.test) return modelsConfig.test;
  if (agentName === "ompimpa-commit" && modelsConfig.commit) return modelsConfig.commit;
  if (agentName === "ompimpa-ironlaw" && modelsConfig.ironlaw) return modelsConfig.ironlaw;
  if (agentName === "ompimpa-security" && modelsConfig.security) return modelsConfig.security;
  if (agentName === "ompimpa-debug" && modelsConfig.debug) return modelsConfig.debug;
  if (agentName === "ompimpa-doc" && modelsConfig.doc) return modelsConfig.doc;
  if (agentName === "ompimpa-triz" && (modelsConfig.triz || modelsConfig.ideate)) return modelsConfig.triz || modelsConfig.ideate!;

  if (
    ["ompimpa-ash", "ompimpa-liveview", "ompimpa-ecto", "ompimpa-oban", "ompimpa-otp"].includes(agentName)
  ) {
    return modelsConfig.dev || DEFAULT_MODELS[agentName] || "default";
  }

  const shortKey = agentName.replace(/^ompimpa-/, "");
  if (modelsConfig[shortKey]) return modelsConfig[shortKey]!;

  return DEFAULT_MODELS[agentName] || "default";
}

export async function syncAgentModels(
  targetDir: string = process.cwd(),
  agentsDir: string = path.join(REPO_ROOT, "agents")
): Promise<{ updated: string[]; total: number }> {
  const tomlPath = path.join(targetDir, "ompimpa.toml");
  let modelsConfig: OmpimpaModelsConfig | undefined;

  if (await fileExists(tomlPath)) {
    const tomlContent = await fs.readFile(tomlPath, "utf-8");
    const parsed = parseToml(tomlContent);
    modelsConfig = parsed.models;
  }

  const updated: string[] = [];
  if (!(await fileExists(agentsDir))) {
    return { updated, total: 0 };
  }

  const files = await fs.readdir(agentsDir);
  const agentFiles = files.filter((f) => f.startsWith("ompimpa-") && f.endsWith(".md"));

  for (const file of agentFiles) {
    const agentName = file.replace(/\.md$/, "");
    const expectedModel = resolveAgentModel(agentName, modelsConfig);
    const filePath = path.join(agentsDir, file);
    const content = await fs.readFile(filePath, "utf-8");

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) continue;

    const frontmatter = frontmatterMatch[1];
    let newFrontmatter: string;

    if (/\bmodel:\s*[^\n]+/.test(frontmatter)) {
      newFrontmatter = frontmatter.replace(/\bmodel:\s*[^\n]+/, `model: ${expectedModel}`);
    } else {
      newFrontmatter = `${frontmatter}\nmodel: ${expectedModel}`;
    }

    if (newFrontmatter !== frontmatter) {
      const newContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${newFrontmatter}\n---`);
      await fs.writeFile(filePath, newContent, "utf-8");
      updated.push(`${file} -> ${expectedModel}`);
    }
  }

  return { updated, total: agentFiles.length };
}

async function runCommand(
  cmd: string,
  args: string[],
  cwd: string = process.cwd(),
  silent: boolean = false
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { promise, resolve } = Promise.withResolvers<{ code: number; stdout: string; stderr: string }>();
  const proc = spawn(cmd, args, { cwd, stdio: ["inherit", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";

  proc.stdout?.on("data", (d) => {
    const str = d.toString();
    stdout += str;
    if (!silent) process.stdout.write(str);
  });

  proc.stderr?.on("data", (d) => {
    const str = d.toString();
    stderr += str;
    if (!silent) process.stderr.write(str);
  });

  proc.on("close", (code) => {
    resolve({ code: code ?? 1, stdout, stderr });
  });

  return promise;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  switch (command) {
    case "init":
      await handleInit(args.slice(1));
      break;
    case "prewalk":
      await handlePrewalk(args.slice(1));
      break;
    case "review":
      await handleReview(args.slice(1));
      break;
    case "sync":
      await handleSync(args.slice(1));
      break;
    case "doctor":
      await handleDoctor(args.slice(1));
      break;
    case "verify":
      await handleVerify(args.slice(1));
      break;
    case "link":
      await handleLink(args.slice(1));
      break;
    case "dev":
      await handleDev(args.slice(1));
      break;
    case "version":
    case "-v":
    case "--version":
      console.log(`ompimpa v${VERSION}`);
      break;
    case "help":
    case "-h":
    case "--help":
    default:
      printHelp();
      break;
  }
}

function printHelp() {
  console.log(`
OMP-IMPA (Integrated Modular Phoenix Architecture for OMP) v${VERSION}

Usage:
  ompimpa <command> [options]

Commands:
  init      Initialize OMP-IMPA configuration and agent prompts in current Phoenix project (Greenfield/Brownfield)
  prewalk   Traverse and scan Elixir code against 26 Iron Laws and TTSR stream rules
  review    Run comprehensive multi-specialist review panel & TEA quality scorecard
  sync      Synchronize ompimpa.toml model tiers into agent frontmatter definitions
  doctor    Diagnose project setup, toolchain availability, and Iron Law violations
  verify    Execute strict Elixir quality gate (compile, format, credo, sobelow, tests)
  link      Link this OMP-IMPA plugin into local OMP environment
  version   Show version information
  help      Show this help message

Options:
  --ash         Force enable Ash Framework presets
  --no-ash      Force use Vanilla Phoenix + Ecto
  --oban        Force enable Oban background job worker configuration
  --no-oban     Force disable Oban presets
  --force       Overwrite existing configuration files

Plugin Installation:
  Global Install (Git):      omp plugin install github:auliabismar/ompimpa
  Marketplace Install:       omp plugin marketplace add auliabismar/ompimpa && omp plugin install ompimpa@ompimpa
  Local Link (Dev):          omp plugin link /path/to/ompimpa
`);
}

async function handlePrewalk(args: string[]) {
  const targetDir = process.cwd();
  const targetPaths = args.filter((a) => !a.startsWith("-"));
  console.log(`\n🔍 Running OMP-IMPA Prewalk AST/Regex Scanner in: ${targetDir}`);
  if (targetPaths.length > 0) {
    console.log(`   Targets: ${targetPaths.join(", ")}`);
  }

  const res: PrewalkScanResult = await runPrewalkScan(targetDir, { targetPaths });
  console.log(`\n📊 Scanned ${res.totalFiles} file(s) against ${res.scannedRules} TTSR rule(s):`);

  if (res.passed) {
    console.log("\n✅ [PREWALK PASSED] Zero Iron Law or TTSR syntax violations detected!");
  } else {
    console.log(`\n❌ [PREWALK FAILED] Found ${res.findings.length} violation(s):\n`);
    for (const f of res.findings) {
      console.log(`  • 🚫 [${f.ruleName}] ${f.file}:${f.line}:${f.column}`);
      console.log(`    Detail: ${f.description}`);
      console.log(`    Matched: \`${f.matchedText}\``);
      if (f.remediation) {
        console.log(`    💡 Remediasi: ${f.remediation}`);
      }
      console.log("");
    }
    process.exit(1);
  }
}

async function handleReview(args: string[]) {
  const targetDir = process.cwd();
  const targetPaths = args.filter((a) => !a.startsWith("-"));
  console.log(`\n🛡️ Running OMP-IMPA Multi-Specialist Review Panel in: ${targetDir}`);

  const result: ReviewResult = await runReview(targetDir, { targetPaths });

  console.log(`\n👥 Active Reviewer Panel (${result.activeReviewers.length} Persona):`);
  for (const r of result.activeReviewers) {
    console.log(`  • [${r.id}] ${r.name} (${r.persona}) -> ${r.role}`);
  }

  console.log(`\n📋 Scorecard Mutu Kualitas (TEA Architecture):`);
  console.log(`  • Spec Review Score:  ${result.scorecard.specScore}/100`);
  console.log(`  • Tech Review Score:  ${result.scorecard.techScore}/100`);
  console.log(`  • Overall TEA Score:  ${result.scorecard.overallScore}/100 (Floor: ${result.scorecard.scoreFloor})`);

  if (result.findings.length > 0) {
    console.log(`\n⚠️ Temuan Audit (${result.findings.length}):`);
    for (const f of result.findings) {
      console.log(`  • [${f.severity}] [${f.category}] ${f.message}`);
      if (f.file) {
        console.log(`    Lokasi: ${f.file}:${f.line || 1}:${f.column || 1}`);
      }
      if (f.remediation) {
        console.log(`    💡 Solusi: ${f.remediation}`);
      }
      console.log("");
    }
  }

  console.log(`\n📢 Verdict: ${result.summary}`);
  if (result.verdict === "BLOCKED") {
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
OMP-IMPA (Integrated Modular Phoenix Architecture for OMP) v${VERSION}

Usage:
  ompimpa <command> [options]

Commands:
  init      Initialize OMP-IMPA configuration and agent prompts in current Phoenix project (Greenfield/Brownfield)
  sync      Synchronize ompimpa.toml model tiers into agent frontmatter definitions
  doctor    Diagnose project setup, toolchain availability, and Iron Law violations
  verify    Execute strict Elixir quality gate (compile, format, credo, sobelow, tests)
  link      Link this OMP-IMPA plugin into local OMP environment
  version   Show version information
  help      Show this help message

Options:
  --ash         Force enable Ash Framework presets
  --no-ash      Force use Vanilla Phoenix + Ecto
  --oban        Force enable Oban background job worker configuration
  --no-oban     Force disable Oban presets
  --force       Overwrite existing configuration files

Plugin Installation:
  Global Install (Git):      omp plugin install github:auliabismar/ompimpa
  Marketplace Install:       omp plugin marketplace add auliabismar/ompimpa && omp plugin install ompimpa@ompimpa
  Local Link (Dev):          omp plugin link /path/to/ompimpa
`);
}

async function handleSync(_flags: string[]) {
  const targetDir = process.cwd();
  console.log(`\n🔄 Synchronizing OMP-IMPA models from ompimpa.toml in: ${targetDir}`);
  const result = await syncAgentModels(targetDir);
  if (result.updated.length > 0) {
    console.log(`✅ Synchronized ${result.updated.length} agent definition(s):`);
    for (const item of result.updated) {
      console.log(`   • ${item}`);
    }
  } else {
    console.log(`✨ All ${result.total} agent model definitions are up to date!`);
  }
}
async function handleInit(flags: string[]) {
  const targetDir = process.cwd();
  console.log(`\n🚀 Initializing OMP-IMPA in: ${targetDir}`);

  const mixPath = path.join(targetDir, "mix.exs");
  const hasMix = await fileExists(mixPath);

  let isBrownfield = false;
  let detectedAsh = false;
  let detectedOban = false;
  let detectedTailwind = false;

  if (hasMix) {
    const mixContent = await fs.readFile(mixPath, "utf-8");
    detectedAsh = /:ash\b/i.test(mixContent);
    detectedOban = /:oban\b/i.test(mixContent);
    detectedTailwind = /:tailwind\b/i.test(mixContent);

    // Cek apakah sudah ada file kode di lib/
    const libDir = path.join(targetDir, "lib");
    if (await fileExists(libDir)) {
      isBrownfield = true;
    }
  } else {
    console.warn("⚠️ Warning: mix.exs not found in current directory. Proceeding with default Greenfield setup.");
  }

  const force = flags.includes("--force");
  const useAsh = flags.includes("--ash") ? true : flags.includes("--no-ash") ? false : detectedAsh;
  const useOban = flags.includes("--oban") ? true : flags.includes("--no-oban") ? false : detectedOban;
  const useTailwind = flags.includes("--tailwind") ? true : detectedTailwind || true;

  console.log(`\n📦 Project Analysis:`);
  console.log(`  • Type: ${isBrownfield ? "Brownfield (Existing Codebase)" : "Greenfield (New Project)"}`);
  console.log(`  • Ash Framework: ${useAsh ? "Enabled (Auto-detected)" : "Disabled"}`);
  console.log(`  • Oban Background Jobs: ${useOban ? "Enabled (Auto-detected)" : "Disabled"}`);
  console.log(`  • Tailwind CSS: ${useTailwind ? "Enabled" : "Disabled"}`);

  // 1. Scaffold Internal OMP-IMPA Governance Folder (_ompimpa/)
  const ompimpaDirs = [
    "_ompimpa/prd",
    "_ompimpa/adr",
    "_ompimpa/status",
    "_ompimpa/ideation",
    "_ompimpa/balairung",
    "_ompimpa/ui",
    "_ompimpa/solutions",
  ];
  for (const dir of ompimpaDirs) {
    await fs.mkdir(path.join(targetDir, dir), { recursive: true });
  }
  console.log("✅ Scaffolding OMP-IMPA governance directory in _ompimpa/");

  // 2. Scaffold Official Project Diátaxis Documentation Folder (docs/)
  const diataxisDirs = [
    "docs/tutorials",
    "docs/how-to",
    "docs/reference",
    "docs/explanation",
  ];

  for (const dir of diataxisDirs) {
    await fs.mkdir(path.join(targetDir, dir), { recursive: true });
  }
  console.log("✅ Scaffolding official Diátaxis documentation structure in docs/");

  // 3. Write ompimpa.toml
  const tomlPath = path.join(targetDir, "ompimpa.toml");
  if (!force && (await fileExists(tomlPath))) {
    console.log("ℹ️  ompimpa.toml already exists (skipped, use --force to overwrite)");
  } else {
    const projectName = path.basename(targetDir);
    const tomlContent = `# ompimpa.toml - Project Governance Configuration (OMP-IMPA)
[project]
name = "${projectName}"

[locale]
communication_language = "id"    # Language used by agents in chat ("id" | "en")
document_output_language = "id"  # Language used in PRD, ADR, and Diataxis docs ("id" | "en")

[governance]
enable_party_mode = true         # Enable multi-persona round-table discussions for /ompimpa:ideate
enable_prd_adr = true            # Enable Master PRD and MADR 3.0+ ADR generation
artifacts_dir = "_ompimpa"       # Directory for internal PRD, ADR, and status files

[quality]
enable_atdd = true               # Enforce Red-Phase ATDD before code implementation
quality_score_floor = 100        # [v2 ADR-001] Skor mutlak 100/100 (port agyimpa 35-Row: -30/-15/-5/-2), PASS hanya 100 (was 90)
scoring_version = "v2"           # [v2 ADR-001] v1=legacy 90/-25/-10/-3, v2=deterministik 100/-30/-15/-5/-2 + dedup hash
warnings_as_errors = true        # Enforce mix compile --warnings-as-errors
max_dev_retries = 3              # Circuit breaker OTP: eskalasi ke manusia jika 3x gagal tes beruntun (sinkron agyimpa max_retries_per_story=3)
auto_macro_review_in_dev = true  # Run automated review before commit at the end of story execution
auto_triage_and_fix = true       # Automatically triage P0/P1 findings and remediate before final commit

[quality.review]
enable_spec_review = true        # Functional Review: Audit Source Code vs PRD Acceptance Criteria (Agus Salim)
enable_tech_review = true        # Technical Review: Audit Elixir/Phoenix compliance (Panel of 6 Specialists)
max_triage_fix_cycles = 3        # [v2 ADR-001] Batas siklus perbaikan otomatis sebelum eskalasi (was 2, sinkron agyimpa 3)
scoring_weights = { Critical = 30, High = 15, Medium = 5, Low = 2 } # [v2] port agyimpa criteria_registry_35.json
allow_p2_nits = false            # [v2] P2 Low tetap BLOCK (was allow), sinkron agyimpa policy.toml allow_p2_nits=false

[quality.nfr]
target_p95_latency_ms = 50       # Target p95 response latency (ms) for PRD non-functional requirements


# Kill criteria per story (A-02) — dirujuk dari _ompimpa/stories.yaml kill_criteria
[stories]
kill_criteria_cache = "_ompimpa/.cache/dag.json" # Jika DAG check >500ms di 100 story → cache
[quality.verify]
steps = [
  "compile --warnings-as-errors",
  "format --check-formatted",
  "test"
]
[quality.verify.tier1] # Inner Loop <2s — blocking per story
steps = ["compile --warnings-as-errors", "format --check-formatted"]
[quality.verify.tier2] # Per-Story Gate <10s — blocking per story
steps = ["test --stale"] # + 7 reviewers + triage 100/100 (B-01/B-02)
[quality.verify.tier3] # Background Audit — non-blocking
steps = ["test", "credo --strict", "sobelow --strict --format json"]

[resources]
use_git_worktrees = true         # Execute parallel tasks in isolated Git Worktrees (~/.omp/wt/)

[models]
balairung = "slow"              # Dewan Tokoh Balairung (3-Round Deliberation & Dialectics)
ideate = "slow"                  # Rohana Kudus & Tan Malaka (Deep TRIZ & First Principles reasoning)
prd = "plan"                     # H. Agus Salim (Master PRD & Architecture Planning)
adr = "plan"                     # H. Agus Salim (Architecture Decision Records)
ui = "design"                    # Marah Rusli (HEEx, Tailwind & Google Stitch Design)
test = "default"                 # Tuanku Imam Bonjol (Red-Phase ATDD Scaffolding)
dev = "default"                  # Backend Specialists (Ash, LiveView, Ecto, Oban, OTP)
commit = "smol"                 # Semantic Commit Message Generator (feat/fix/test/refactor)
ironlaw = "smol"                 # Hj. Rasuna Said (Fast & deterministic Iron Law verification)
security = "slow"                # Bagindo Azizchan (Deep perimeter security & vulnerability audit)
debug = "slow"                   # Adinegoro (4-track deep root cause investigation)
doc = "default"                  # Mohammad Yamin (Diátaxis User, Admin, Dev Guides)

[stacks]
use_ash_framework = ${useAsh}     # Ash Framework or Vanilla Ecto
use_oban = ${useOban}              # Oban background job processor
use_tailwind = ${useTailwind}          # Tailwind CSS styling

[stacks.liveview]
stream_threshold_rows = 100      # Rows threshold before mandatory LiveView Streams

[documentation]
diataxis_format = true           # Apply Diataxis 4-quadrant standard
output_dir = "docs"              # Target directory for official Diataxis docs

[tools]
enable_compound_memory = true    # Index and store proven solution patterns in _ompimpa/solutions/

[runtime_verification]
browser_e2e = true               # Verify critical UI paths in Headless Chromium
in_process_liveview = true       # Run Phoenix.LiveViewTest in-process (~5ms)
`;
    await fs.writeFile(tomlPath, tomlContent, "utf-8");
    console.log("✅ Created ompimpa.toml");
  }

  // 4. Write _ompimpa/status/feature-status.yaml
  const statusYamlPath = path.join(targetDir, "_ompimpa", "status", "feature-status.yaml");
  if (!force && (await fileExists(statusYamlPath))) {
    console.log("ℹ️  _ompimpa/status/feature-status.yaml already exists (skipped)");
  } else {
    const yamlContent = `# feature-status.yaml - OMP-IMPA Feature & Slice Roadmap State
# Auto-synced during /ompimpa:dev execution

features: {}
`;
    await fs.writeFile(statusYamlPath, yamlContent, "utf-8");
    console.log("✅ Created _ompimpa/status/feature-status.yaml");
  }

  // 4b. A-02: Ensure canonical _ompimpa/stories.yaml and compat symlink
  const storiesYamlPath = path.join(targetDir, "_ompimpa", "stories.yaml");
  if (!(await fileExists(storiesYamlPath))) {
    const repoStories = path.join(REPO_ROOT, "_ompimpa", "stories.yaml");
    if (await fileExists(repoStories)) {
      const content = await fs.readFile(repoStories, "utf-8");
      await fs.writeFile(storiesYamlPath, content, "utf-8");
      console.log("✅ Created _ompimpa/stories.yaml (canonical DAG)");
    } else if (await fileExists(path.join(REPO_ROOT, "templates", "ompimpa.toml"))) {
      console.log("ℹ️  stories.yaml not found in repo template, skipping");
    }
  } else {
    console.log("ℹ️  _ompimpa/stories.yaml already exists");
  }
  // Compat: _ompimpa/status/stories.yaml -> ../stories.yaml
  const compatStoriesPath = path.join(targetDir, "_ompimpa", "status", "stories.yaml");
  try {
    if (!(await fileExists(compatStoriesPath)) && (await fileExists(storiesYamlPath))) {
      try {
        const rel = path.relative(path.dirname(compatStoriesPath), storiesYamlPath);
        await fs.symlink(rel, compatStoriesPath);
        console.log("✅ Created symlink _ompimpa/status/stories.yaml -> ../stories.yaml");
      } catch {
        const c = await fs.readFile(storiesYamlPath, "utf-8");
        await fs.writeFile(compatStoriesPath, c, "utf-8");
        console.log("✅ Created compat _ompimpa/status/stories.yaml (copy)");
      }
    }
  } catch {
    // ignore
  }

  // 5. Write AGENTS.md
  const agentsMdPath = path.join(targetDir, "AGENTS.md");
  const templateAgents = path.join(REPO_ROOT, "templates", "AGENTS.md.template");
  if (await fileExists(templateAgents)) {
    if (!force && (await fileExists(agentsMdPath))) {
      console.log("ℹ️  AGENTS.md already exists (skipped, use --force to overwrite)");
    } else {
      const content = await fs.readFile(templateAgents, "utf-8");
      await fs.writeFile(agentsMdPath, content, "utf-8");
      console.log("✅ Created AGENTS.md");
    }
  }

  // 6. Write CLAUDE.md
  const claudeMdPath = path.join(targetDir, "CLAUDE.md");
  const templateClaude = path.join(REPO_ROOT, "templates", "CLAUDE.md.template");
  if (await fileExists(templateClaude)) {
    if (!force && (await fileExists(claudeMdPath))) {
      console.log("ℹ️  CLAUDE.md already exists (skipped, use --force to overwrite)");
    } else {
      const content = await fs.readFile(templateClaude, "utf-8");
      await fs.writeFile(claudeMdPath, content, "utf-8");
      console.log("✅ Created CLAUDE.md");
    }
  }

  // 7. Install Git Pre-Commit Hook
  const gitDir = path.join(targetDir, ".git");
  if (await fileExists(gitDir)) {
    const hooksDir = path.join(gitDir, "hooks");
    await fs.mkdir(hooksDir, { recursive: true });
    const preCommitHook = path.join(hooksDir, "pre-commit");
    const templateHook = path.join(REPO_ROOT, "templates", "pre-commit.sh");
    if (await fileExists(templateHook)) {
      const content = await fs.readFile(templateHook, "utf-8");
      await fs.writeFile(preCommitHook, content, { mode: 0o755 });
      console.log("✅ Installed .git/hooks/pre-commit (Fast Pre-Commit Quality Gate)");
    }
  }
  // 8. Synchronize Model Tiers to Agent Definitions
  await syncAgentModels(targetDir);
  console.log("✅ Synchronized agent models from ompimpa.toml to agents/");

  console.log("\n🎉 OMP-IMPA initialization complete!");
  console.log("👉 Run `ompimpa doctor` to check project health.");
  console.log("👉 Start your session with `omp` and run `/ompimpa:ideate` or `/ompimpa:prd`.");
}

export async function validateDiataxisStructure(
  targetDir: string = process.cwd(),
  docsDirName: string = "docs"
): Promise<{ valid: boolean; quadrants: Record<string, number>; issues: string[] }> {
  const docsPath = path.join(targetDir, docsDirName);
  const quadrants: Record<string, number> = {
    tutorials: 0,
    "how-to": 0,
    reference: 0,
    explanation: 0,
  };
  const issues: string[] = [];

  if (!(await fileExists(docsPath))) {
    return { valid: false, quadrants, issues: [`Documentation directory '${docsDirName}' does not exist`] };
  }

  for (const q of Object.keys(quadrants)) {
    const qPath = path.join(docsPath, q);
    if (await fileExists(qPath)) {
      const files = await fs.readdir(qPath);
      quadrants[q] = files.filter((f) => f.endsWith(".md")).length;
    } else {
      issues.push(`Missing Diátaxis quadrant folder: ${docsDirName}/${q}`);
    }
  }

  return { valid: issues.length === 0, quadrants, issues };
}

export function parseVerifyStep(stepStr: string): { name: string; cmd: string; args: string[] } {
  const parts = stepStr.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { name: "mix", cmd: "mix", args: [] };

  if (parts[0] === "mix") {
    return { name: `mix ${parts.slice(1).join(" ")}`, cmd: "mix", args: parts.slice(1) };
  }
  return { name: `mix ${parts.join(" ")}`, cmd: "mix", args: parts };
}

async function handleDoctor(_flags: string[]) {
  const targetDir = process.cwd();
  console.log(`\n🩺 Running OMP-IMPA Doctor on: ${targetDir}\n`);

  let issues = 0;

  // 1. Check configs
  const checks = [
    { file: "mix.exs", label: "Elixir Mix project" },
    { file: "ompimpa.toml", label: "OMP-IMPA configuration" },
    { file: "_ompimpa/status/feature-status.yaml", label: "Feature roadmap state" },
    { file: "AGENTS.md", label: "Agent instructions (AGENTS.md)" },
    { file: ".git/hooks/pre-commit", label: "Git pre-commit quality hook" },
  ];

  for (const c of checks) {
    const exists = await fileExists(path.join(targetDir, c.file));
    if (exists) {
      console.log(`  ✅ [FOUND] ${c.label} (${c.file})`);
    } else {
      console.log(`  ❌ [MISSING] ${c.label} (${c.file})`);
      issues++;
    }
  }

  // 2. Check Subagent Model Bindings
  console.log("\n🤖 OMP Subagent Model Bindings:");
  const agentsDir = path.join(REPO_ROOT, "agents");
  try {
    const agentFiles = (await fs.readdir(agentsDir)).filter((f) => f.startsWith("ompimpa-") && f.endsWith(".md"));
    const tomlPath = path.join(targetDir, "ompimpa.toml");
    let modelsConfig: OmpimpaModelsConfig | undefined;
    if (await fileExists(tomlPath)) {
      const content = await fs.readFile(tomlPath, "utf-8");
      modelsConfig = parseToml(content).models;
    }

    for (const f of agentFiles) {
      const agentName = f.replace(/\.md$/, "");
      const filePath = path.join(agentsDir, f);
      const content = await fs.readFile(filePath, "utf-8");
      const modelMatch = content.match(/\bmodel:\s*([^\n]+)/);
      const boundModel = modelMatch ? modelMatch[1].trim() : "unbound";
      const expectedModel = resolveAgentModel(agentName, modelsConfig);
      const isSynced = boundModel === expectedModel;
      console.log(`  ${isSynced ? "✅" : "⚠️"} [${isSynced ? "SYNCED" : "DRIFT"}] ${agentName} -> ${boundModel} (expected: ${expectedModel})`);
      if (!isSynced) issues++;
    }
  } catch {
    console.log(`  ⚠️ [WARNING] Failed to inspect agents directory (${agentsDir})`);
  }

  // 3. Check Diátaxis Documentation Structure
  console.log("\n📚 Diátaxis Documentation Structure:");
  const tomlPath = path.join(targetDir, "ompimpa.toml");
  let docsDirName = "docs";
  if (await fileExists(tomlPath)) {
    const content = await fs.readFile(tomlPath, "utf-8");
    const parsed = parseToml(content);
    if (parsed.documentation?.output_dir) docsDirName = parsed.documentation.output_dir;
  }
  const diataxis = await validateDiataxisStructure(targetDir, docsDirName);
  if (diataxis.valid) {
    console.log(`  ✅ [VALID] Diátaxis 4-quadrant layout active in '${docsDirName}/'`);
    for (const [quadrant, count] of Object.entries(diataxis.quadrants)) {
      console.log(`     • ${quadrant}: ${count} document(s)`);
    }
  } else {
    console.log(`  ⚠️ [WARNING] Diátaxis structure incomplete in '${docsDirName}/':`);
    for (const issue of diataxis.issues) {
      console.log(`     • ${issue}`);
    }
  }

  // 4. Check OMP-IMPA TTSR Stream Rules
  console.log("\n🛡️ OMP TTSR Real-Time Stream Rules:");
  const rulesDir = path.join(REPO_ROOT, "rules");
  try {
    const ruleFiles = await fs.readdir(rulesDir);
    const modularRules = ruleFiles.filter(
      (f) => f.startsWith("elixir-") && f.endsWith(".md") && !f.includes("iron-laws")
    );
    console.log(`  ✅ [ACTIVE] Loaded ${modularRules.length} modular TTSR real-time stream rule(s) in rules/`);
    for (const r of modularRules) {
      console.log(`     • ${r}`);
    }
  } catch {
    console.log(`  ⚠️ [WARNING] Failed to load TTSR rules directory (${rulesDir})`);
  }

  // 5. Check OMP Plugin Manifests
  console.log("\n🔌 OMP Plugin Manifests:");
  const ompPluginJson = path.join(REPO_ROOT, ".omp-plugin", "plugin.json");
  const ompMarketplaceJson = path.join(REPO_ROOT, ".omp-plugin", "marketplace.json");
  if (await fileExists(ompPluginJson)) {
    console.log(`  ✅ [FOUND] OMP Plugin manifest (.omp-plugin/plugin.json)`);
  }
  if (await fileExists(ompMarketplaceJson)) {
    console.log(`  ✅ [FOUND] OMP Marketplace catalog (.omp-plugin/marketplace.json)`);
  }

  // 6. Check toolchains
  console.log("\n🛠️ Toolchain availability:");
  const tools = ["omp", "mix", "git", "bun", "rtk"];
  for (const tool of tools) {
    const res = await runCommand("which", [tool], targetDir, true);
    if (res.code === 0 && res.stdout.trim()) {
      console.log(`  ✅ [INSTALLED] ${tool}: ${res.stdout.trim()}`);
    } else {
      console.log(`  ⚠️ [NOT FOUND] ${tool}`);
    }
  }

  if (issues === 0) {
    console.log("\n✨ All OMP-IMPA components are properly configured!");
  } else {
    console.log(`\n⚠️ Found ${issues} issue(s). Run \`ompimpa sync\` or \`ompimpa init\` to repair.`);
  }
}

async function handleVerify(_flags: string[]) {
  const targetDir = process.cwd();
  const tomlPath = path.join(targetDir, "ompimpa.toml");
  let stepsConfig: string[] = [
    "compile --warnings-as-errors",
    "format --check-formatted",
    "test",
  ];

  if (await fileExists(tomlPath)) {
    const tomlContent = await fs.readFile(tomlPath, "utf-8");
    const parsed = parseToml(tomlContent);
    if (parsed.quality?.verify?.steps && parsed.quality.verify.steps.length > 0) {
      stepsConfig = parsed.quality.verify.steps;
    }
  }

  console.log(`\n🛡️ Executing OMP-IMPA Strict Quality Gate (${stepsConfig.length} steps) in: ${targetDir}\n`);

  for (const stepStr of stepsConfig) {
    const step = parseVerifyStep(stepStr);
    console.log(`\n▶️ [STEP] ${step.name} (\`${step.cmd} ${step.args.join(" ")}\`):`);
    const res = await runCommand(step.cmd, step.args, targetDir);
    if (res.code !== 0) {
      console.error(`\n❌ Quality gate FAILED at step: ${step.name}`);
      process.exit(res.code);
    }
  }

  console.log("\n🏆 100% Quality Gate PASSED: All configured steps green!");
}

async function handleLink(_flags: string[]) {
  console.log(`\n🔗 Linking OMP-IMPA (${REPO_ROOT}) into OMP...`);
  const res = await runCommand("omp", ["plugin", "link", REPO_ROOT]);
  if (res.code === 0) {
    console.log("✅ Successfully linked ompimpa plugin into OMP!");
  } else {
    console.error("❌ Failed to link plugin into OMP.");
    process.exit(res.code);
  }
}

async function handleDev(flags: string[]) {
  const targetDir = process.cwd();
  // Parse flags
  let epicFilter: string | null = null;
  let storyFilter: string | null = null;
  let auto = false;
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f === "--epic" && flags[i + 1]) {
      epicFilter = flags[i + 1];
      i++;
    } else if (f.startsWith("--epic=")) {
      epicFilter = f.split("=")[1];
    } else if (f === "--story" && flags[i + 1]) {
      storyFilter = flags[i + 1];
      i++;
    } else if (f.startsWith("--story=")) {
      storyFilter = f.split("=")[1];
    } else if (f === "--auto") {
      auto = true;
    }
  }

  // Load stories.yaml DAG
  const storiesYamlPath = path.join(targetDir, "_ompimpa", "stories.yaml");
  const fallbackPath = path.join(targetDir, "_ompimpa", "status", "stories.yaml");
  let storiesContent: string | null = null;
  let storiesPathUsed = storiesYamlPath;
  try {
    storiesContent = await fs.readFile(storiesYamlPath, "utf-8");
  } catch {
    try {
      storiesContent = await fs.readFile(fallbackPath, "utf-8");
      storiesPathUsed = fallbackPath;
    } catch {
      console.error(`❌ stories.yaml not found at ${storiesYamlPath}`);
      process.exit(1);
    }
  }
  const stories = parseStoriesYaml(storiesContent!);
  const dag = checkCircularDAG(stories);
  if (dag.hasCycle) {
    console.error(`❌ DAG circular detected: ${dag.cyclePath?.join(" -> ")}`);
    process.exit(1);
  }
  console.log(`✅ DAG validated: ${dag.sorted?.join(" → ")} (source: ${path.relative(targetDir, storiesPathUsed)})`);

  // Load feature-status
  const statusPath = path.join(targetDir, "_ompimpa", "status", "feature-status.yaml");
  let statusContent = "";
  try {
    statusContent = await fs.readFile(statusPath, "utf-8");
  } catch {
    console.warn(`⚠️ feature-status.yaml not found, assuming empty`);
  }
  const { doneIds, statusMap } = parseFeatureStatusYaml(statusContent);

  // Handle --story blocker
  if (storyFilter) {
    const blocked = getBlockedStory(storyFilter, stories, doneIds);
    if (blocked) {
      console.error(`🚫 Blocked: dependency ${blocked} not done`);
      process.exit(1);
    }
    const st = statusMap.get(storyFilter);
    console.log(`▶️ Story ${storyFilter} status: ${st || "unknown"} — ready for dev`);
    if (st === "done") {
      console.log(`✅ Story ${storyFilter} already done`);
    }
    // For single story, we would dispatch dev here; for now just validate
    return;
  }

  // Handle --epic
  if (epicFilter) {
    const epicStories = stories.filter((s) => s.epic === epicFilter);
    if (epicStories.length === 0) {
      console.error(`❌ Epic ${epicFilter} not found`);
      process.exit(1);
    }
    // Get topological order filtered by epic, but respecting global DAG order
    const globalOrder = dag.sorted || [];
    const epicOrder = globalOrder.filter((id) => epicStories.some((s) => s.id === id));
    console.log(`\n📦 Epic ${epicFilter} — ${epicStories.length} stories in DAG order: ${epicOrder.join(" → ")}`);
    if (auto) {
      console.log(`🤖 Auto loop for epic ${epicFilter} — sequential per story with isolated review`);
      for (const sid of epicOrder) {
        const blocked = getBlockedStory(sid, stories, doneIds);
        if (blocked) {
          console.error(`🚫 Blocked: ${sid} depends on ${blocked} not done — stopping epic loop`);
          process.exit(1);
        }
        const st = statusMap.get(sid) || "backlog";
        console.log(`  • ${sid}: ${st} ${st === "done" ? "✅" : st === "in-progress" || st === "ready-for-dev" ? "▶️" : "⏳"}`);
      }
      console.log(`\n✅ Epic ${epicFilter} DAG ready — loop would execute story by story with 7→10 isolated reviewers`);
    }
    return;
  }

  // Default: show next ready
  if (auto) {
    console.log(`🤖 Auto loop — checking next ready story in DAG order`);
    for (const sid of dag.sorted || []) {
      const st = statusMap.get(sid);
      const blocked = getBlockedStory(sid, stories, doneIds);
      if (!blocked && (st === "ready-for-dev" || st === "in-progress" || st === "backlog")) {
        console.log(`▶️ Next story: ${sid} (status: ${st})`);
        break;
      }
    }
  }
}


if (import.meta.main) {
  main().catch((err) => {
    console.error("ompimpa error:", err);
    process.exit(1);
  });
}
