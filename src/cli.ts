import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { parseToml, loadOmpimpaConfig, type OmpimpaModelsConfig } from "../hooks/ompimpa-guard";
import {
  runPrewalkScan,
  type PrewalkScanResult,
  parseStoriesYaml,
  checkCircularDAG,
  parseFeatureStatusYaml,
  getBlockedStory,
} from "./prewalk";
import { runReview, dispatchIsolatedReview, loadReviewSessionMarker, buildReviewPanel, type ReviewResult } from "./reviewer";
import { generateStorySpec, loadStoryDetail, partitionTargetFiles, type StoryDetail, type StoryAC } from "./story_spec";
import { aggregateReviews, isEnvelopeCleanReport, calculateScore, remediationPlan, type AggregateResult } from "./triage";
import { detectContestedFindings, applyAdjudicationResults, runAdjudicationTask } from "./mini_balairung";
import { runEpicLoop, runStoryPhases, updateFeatureStatus, commitStoryChanges, appendSpecLedger } from "./loop_runner";
import { validateBalairungInventory, checkPrdCoverage } from "./inventory";
const VERSION = "1.0.0";
import { runTui } from "./tui/index";
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

export const DEFAULT_MODELS: Record<string, string> = {
  "ompimpa-balairung": "slow",
  "ompimpa-ideate": "slow",
  "ompimpa-prd": "plan",
  "ompimpa-adr": "plan",
  "ompimpa-ui": "vision",
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
  proc.on("error", (err) => {
    resolve({ code: 1, stdout, stderr: `${stderr}\nSpawn error: ${err.message}` });
  });
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
    case "graphify":
      await handleGraphify(args.slice(1));
      break;
    case "sweep":
      await handleSweep(args.slice(1));
      break;
    case "doc":
      await handleDoc(args.slice(1));
      break;
    case "inspect":
    case "inspeksi":
      await handleInspect(args.slice(1));
      break;
    case "story":
      await handleStory(args.slice(1));
      break;
    case "atdd":
      await handleAtdd(args.slice(1));
      break;
    case "inventory":
      await handleInventory(args.slice(1));
      break;
    case "code":
      await handleCode(args.slice(1));
      break;
    case "triage":
      await handleTriage(args.slice(1));
      break;
    case "status":
      await handleStatus(args.slice(1));
      break;
    case "tui":
      await handleTui(args.slice(1));
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
  link      Link plugin into OMP + install \`ompimpa\` CLI shim to ~/.local/bin (one-step installer)
  prewalk   Traverse and scan Elixir code against 26 Iron Laws and TTSR stream rules
  review    Run comprehensive multi-specialist review panel & TEA quality scorecard
  sync      Synchronize ompimpa.toml model tiers into agent frontmatter definitions
  doctor    Diagnose project setup, toolchain availability, and Iron Law violations
  verify    Execute strict Elixir quality gate (compile, format, credo, sobelow, tests)
  dev       Coordinate modular 5-phase engineering pipeline or outer loop per epic
  graphify  Generate _ompimpa/graph.json + graph.html blast-radius (C-01)
  sweep     Promote deferred P2 entries to ready-for-dev (C-02)
  doc       Generate Diátaxis docs deterministically (C-05)
  inspect   Run unified master diagnostic out-of-band & auto-generate EPIC-DEBT (E-03)
  story     Scaffold JIT micro-specification SPEC-[ID].md (D-01)
  atdd      Validate Red-Phase ATDD scaffold (SPEC gate + test files exist) before code (E-01)
  code      Execute isolated green coding phase per story (D-02)
  review    Run comprehensive multi-specialist review panel & TEA quality scorecard
  triage    Run deterministic deduplication & 100/100 scoring scorecard (D-02)
  status    Show story/epic status: SPEC, tests, review evidence, triage verdict, ledger, git (read-only)
  tui       Launch interactive terminal monitoring dashboard for active ompimpa loops
  inventory Validate Balairung inventory table + PRD coverage gate (anti scope-truncation)
  help      Show this help message

Options:
  --ash         Force enable Ash Framework presets
  --no-ash      Force use Vanilla Phoenix + Ecto
  --oban        Force enable Oban background job worker configuration
  --no-oban     Force disable Oban presets
  --force       Overwrite existing configuration files
  --adjudicate  Force enable Tier 2.5 Mini Balairung adjudication
  --no-adjudicate Disable Tier 2.5 adjudication (use 0-token deterministic fallback)
  --adjudication-timeout-ms <n> Adjudication timeout in milliseconds (default: 30000)

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
  let storyId: string | undefined;
  let autoDispatch = false;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--auto" || a === "--dispatch") {
      autoDispatch = true;
    } else if ((a === "--story" || a === "-s") && args[i + 1]) {
      storyId = args[i + 1];
      i++;
    } else if (a.startsWith("--story=")) {
      storyId = a.split("=")[1];
    } else {
      rest.push(a);
    }
  }
  // Bentuk lama `ompimpa review <STORY_ID>`: kenali ID story posisi tunggal (huruf-angka-hubung, tanpa slash/titik).
  let targetPaths = rest;
  if (!storyId && rest.length === 1 && /^[A-Za-z0-9_-]+$/.test(rest[0]) && !rest[0].includes(".")) {
    storyId = rest[0];
    targetPaths = [];
  }
  if (storyId && targetPaths.length === 0) {
    try {
      const { story } = await loadStoryDetail(storyId, targetDir);
      const { targetFiles, testFiles } = partitionTargetFiles(story, targetDir);
      targetPaths = [...targetFiles, ...testFiles];
    } catch {}
  }
  if (storyId && autoDispatch) {
    await dispatchIsolatedReview(storyId, { targetDir });
  }
  console.log(`\n🛡️ Running OMP-IMPA Multi-Specialist Review Panel in: ${targetDir}`);
  if (storyId) {
    console.log(`   Story: ${storyId} (INV-01 isolation enforced — tanpa berkas isolated = P0 BLOCKED)`);
    if (targetPaths.length > 0) {
      console.log(`   Target Files (${targetPaths.length}): ${targetPaths.join(", ")}`);
    }
  }

  const result: ReviewResult = await runReview(targetDir, { targetPaths, storyId });

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
ui = "vision"                    # Marah Rusli (HEEx, Tailwind & Google Stitch Design)
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

  // 5. Write AGENTS.md — C-04 Wizard Greenfield/Brownfield Detection
  const agentsMdPath = path.join(targetDir, "AGENTS.md");
  const templateAgents = path.join(REPO_ROOT, "templates", "AGENTS.md.template");
  if (await fileExists(templateAgents)) {
    if (!force && (await fileExists(agentsMdPath))) {
      console.log("ℹ️  AGENTS.md already exists (skipped, use --force to overwrite)");
    } else {
      let content = await fs.readFile(templateAgents, "utf-8");
      // C-04: Inject scope variant
      const scope = isBrownfield ? "delta" : "full";
      const projectType = isBrownfield ? "Brownfield" : "Greenfield";
      content = content.replace(/\{\{scope\}\}/g, scope).replace(/\{\{projectType\}\}/g, projectType);
      // Append scope header if not already templated
      if (!content.includes("scope=")) {
        content += `\n\n> **Setup Wizard:** ${projectType} (scope=${scope}) — ${isBrownfield ? "Existing codebase detected (mix.exs + lib/ ada)" : "New project (no mix.exs/lib)"}\n`;
      }
      await fs.writeFile(agentsMdPath, content, "utf-8");
      console.log(`✅ Created AGENTS.md (${projectType} scope=${scope})`);
    }
  }

  // 6. Write CLAUDE.md — C-04 variant
  const claudeMdPath = path.join(targetDir, "CLAUDE.md");
  const templateClaude = path.join(REPO_ROOT, "templates", "CLAUDE.md.template");
  if (await fileExists(templateClaude)) {
    if (!force && (await fileExists(claudeMdPath))) {
      console.log("ℹ️  CLAUDE.md already exists (skipped, use --force to overwrite)");
    } else {
      let content = await fs.readFile(templateClaude, "utf-8");
      const scope = isBrownfield ? "delta" : "full";
      const projectType = isBrownfield ? "Brownfield" : "Greenfield";
      content = content.replace(/\{\{scope\}\}/g, scope).replace(/\{\{projectType\}\}/g, projectType);
      if (!content.includes("scope=")) {
        content += `\n\n> **Setup Wizard:** ${projectType} (scope=${scope}) — ${isBrownfield ? "mix.exs ada & lib/ tidak kosong → delta sync" : "Greenfield → full scaffold"}\n`;
      }
      await fs.writeFile(claudeMdPath, content, "utf-8");
      console.log(`✅ Created CLAUDE.md (${projectType} scope=${scope})`);
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

  // 4. Check OMP-IMPA TTSR Stream Rules — A-01 1:1 26 Laws (numeric 01..26) + legacy elixir-* for compat
  console.log("\n🛡️ OMP TTSR Real-Time Stream Rules:");
  const rulesDir = path.join(REPO_ROOT, "rules");
  try {
    const ruleFiles = await fs.readdir(rulesDir);
    const modularRules = ruleFiles.filter(
      (f) => (f.startsWith("elixir-") || /^\d{2}-/.test(f)) && f.endsWith(".md") && !f.includes("iron-laws") && !f.includes("quality-gates") && !f.includes("pitfalls")
    );
    // Prefer numeric 26 if available (A-01)
    const numericCount = modularRules.filter((f) => /^\d{2}-/.test(f)).length;
    const displayCount = numericCount >= 26 ? numericCount : modularRules.length;
    console.log(`  ✅ [ACTIVE] Loaded ${displayCount} modular TTSR real-time stream rule(s) in rules/`);
    for (const r of modularRules.slice(0, 30)) {
      console.log(`     • ${r}`);
    }
    if (modularRules.length > 30) console.log(`     • … +${modularRules.length - 30} more`);
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

async function handleVerify(flags: string[]) {
  const targetDir = process.cwd();
  const tomlPath = path.join(targetDir, "ompimpa.toml");
  const fallbackTplPath = path.join(REPO_ROOT, "templates", "ompimpa.toml");

  let tier1Steps: string[] = ["compile --warnings-as-errors", "format --check-formatted"];
  let tier2Steps: string[] = ["test --stale"];
  let tier3Steps: string[] = ["test", "credo --strict", "sobelow --strict --format json"];
  let flatSteps: string[] | null = null;

  const loadSteps = async (p: string) => {
    try {
      const content = await fs.readFile(p, "utf-8");
      const parsed = parseToml(content);
      const qv: any = (parsed as any).quality?.verify;
      if (qv) {
        if (qv.tier1?.steps?.length) tier1Steps = qv.tier1.steps;
        if (qv.tier2?.steps?.length) tier2Steps = qv.tier2.steps;
        if (qv.tier3?.steps?.length) tier3Steps = qv.tier3.steps;
        if (qv.steps?.length) flatSteps = qv.steps;
      }
    } catch {}
  };

  // Try project ompimpa.toml first, fallback to templates
  await loadSteps(tomlPath);
  if (!flatSteps && !(await fileExists(tomlPath))) {
    await loadSteps(fallbackTplPath);
  }

  const hasTiered = flags.includes("--tier1") || flags.includes("--tier2") || flags.includes("--tier3") || flags.includes("--all");
  let tiers: Array<{ name: string; steps: string[] }> = [];

  if (flags.includes("--tier1")) {
    tiers = [{ name: "T1 (<2s)", steps: tier1Steps }];
  } else if (flags.includes("--tier2")) {
    tiers = [{ name: "T2 (<10s)", steps: tier2Steps }];
  } else if (flags.includes("--tier3")) {
    tiers = [{ name: "T3 (background)", steps: tier3Steps }];
  } else if (flags.includes("--all")) {
    tiers = [
      { name: "T1 (<2s)", steps: tier1Steps },
      { name: "T2 (<10s)", steps: tier2Steps },
      { name: "T3 (background)", steps: tier3Steps },
    ];
  } else if (flatSteps && !tier1Steps.length && !tier2Steps.length) {
    // legacy flat mode
    tiers = [{ name: "Quality Gate", steps: flatSteps }];
  } else {
    // B-04 default: dev loop hanya T1+T2 (<12s), T3 background not blocking
    tiers = [
      { name: "T1 (<2s)", steps: tier1Steps },
      { name: "T2 (<10s)", steps: tier2Steps },
    ];
    console.log(`\n🛡️ Tiered Verify — T1+T2 (<12s) blocking, T3 background (use --tier3 or --all for full)`);
  }

  console.log(`\n🛡️ Executing OMP-IMPA Strict Quality Gate in: ${targetDir}\n`);

  for (const tier of tiers) {
    console.log(`\n▶️ [${tier.name}] ${tier.steps.length} steps:`);
    for (const stepStr of tier.steps) {
      const step = parseVerifyStep(stepStr);
      console.log(`  ▶️ [STEP] ${step.name} (\`${step.cmd} ${step.args.join(" ")}\`):`);
      const res = await runCommand(step.cmd, step.args, targetDir);
      if (res.code !== 0) {
        console.error(`\n❌ Quality gate FAILED at ${tier.name} step: ${step.name}`);
        // B-04 AC-2: Jika T1 gagal langsung REMEDIATE tanpa T2
        if (tier.name.includes("T1")) {
          console.error(`🚫 T1 failed — skip T2 (B-04 AC-2: langsung REMEDIATE tanpa T2)`);
        }
        process.exit(res.code);
      }
    }
  }

  // If default mode (T1+T2), note T3 background
  if (!hasTiered && tiers.length === 2) {
    console.log(`\n💤 T3 background steps (not blocking): ${tier3Steps.join(", ")} — run \`ompimpa verify --tier3\` or \`--all\` for full audit`);
  }

  console.log("\n🏆 100% Quality Gate PASSED: All configured steps green!");
}

/**
 * Memasang shim CLI `ompimpa` ke direktori bin milik pengguna yang ada di PATH
 * (~/.local/bin didahulukan, lalu ~/bin). Idempoten: symlink basi diganti,
 * berkas nyata tidak pernah ditimpa. Mengembalikan path terpasang atau null.
 */
export async function installCliShim(
  repoRoot: string = REPO_ROOT,
  binDirs?: string[]
): Promise<{ installed: string | null; tried: string[] }> {
  const home = process.env.HOME || os.homedir() || "";
  const candidates = binDirs || [path.join(home, ".local", "bin"), path.join(home, "bin")];
  const tried: string[] = [];
  const source = path.join(repoRoot, "bin", "ompimpa");
  try {
    await fs.access(source, fs.constants.X_OK);
  } catch {
    return { installed: null, tried: candidates };
  }
  const pathDirs = (process.env.PATH || "").split(path.delimiter);
  for (const dir of candidates) {
    tried.push(dir);
    if (!pathDirs.includes(dir)) continue;
    try {
      await fs.mkdir(dir, { recursive: true });
      const dest = path.join(dir, "ompimpa");
      try {
        const st = await fs.lstat(dest);
        if (st.isSymbolicLink()) await fs.unlink(dest);
        else continue;
      } catch {
        // Belum ada — lanjut pasang.
      }
      await fs.symlink(source, dest);
      return { installed: dest, tried };
    } catch {
      continue;
    }
  }
  return { installed: null, tried };
}

async function handleLink(_flags: string[]) {
  console.log(`\n🔗 Linking OMP-IMPA (${REPO_ROOT}) into OMP...`);
  const res = await runCommand("omp", ["plugin", "link", REPO_ROOT]);
  if (res.code === 0) {
    console.log("✅ Successfully linked ompimpa plugin into OMP!");
  } else {
    console.error("❌ Failed to link plugin into OMP.");
  }
  const shim = await installCliShim(REPO_ROOT);
  if (shim.installed) {
    console.log(`✅ CLI tersedia sebagai \`ompimpa\` di ${shim.installed} (contoh: ompimpa dev --epic EPIC-D --auto)`);
  } else {
    console.warn(`⚠️ Tidak ada direktori bin di PATH (${shim.tried.join(", ")}). Sementara pakai: bun run bin/ompimpa <command>`);
  }
  if (res.code !== 0) process.exit(res.code);
}

async function handleDev(flags: string[]) {
  const targetDir = process.cwd();
  // Parse flags
  let epicFilter: string | null = null;
  let storyFilter: string | null = null;
  let auto = false;
  let noHarness = false;
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
    } else if (f === "--no-harness") {
      noHarness = true;
    }
  }
  // --auto = opt-in otonom penuh: fase code/review dijalankan sebagai sesi omp
  // nyata. Tanpa --auto (atau dengan --no-harness): hanya gerbang lokal, kerja
  // kreatif tetap di sesi interaktif.
  const ompimpaConfig = loadOmpimpaConfig(targetDir);
  const harness = auto && !noHarness
    ? {
        enabled: true,
        binary: ompimpaConfig.harness?.binary,
        modelDev: ompimpaConfig.harness?.model_dev || ompimpaConfig.models?.dev,
        modelReview: ompimpaConfig.harness?.model_review,
        sessionTimeoutMs: ompimpaConfig.harness?.session_timeout_ms,
      }
    : undefined;

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

  // Handle --story: eksekusi pipeline 5 fase nyata (story → atdd → code → review → triage)
  if (storyFilter) {
    const blocked = getBlockedStory(storyFilter, stories, doneIds);
    if (blocked) {
      console.error(`🚫 Blocked: dependency ${blocked} not done`);
      process.exit(1);
    }
    const st = statusMap.get(storyFilter);
    if (st === "done") {
      console.log(`✅ Story ${storyFilter} already done — tidak ada gap tersisa.`);
      return;
    }
    console.log(`▶️ Story ${storyFilter} status: ${st || "backlog"} — mengeksekusi 5 fase (story → atdd → code → review → triage).`);
    await updateFeatureStatus(targetDir, storyFilter, "in-progress", 0);
    const result = await runStoryPhases(storyFilter, { targetDir, harness });
    if (!result.success) {
      console.error(`❌ Story ${storyFilter} gagal pada fase ${result.phases[result.phases.length - 1]?.phase}: ${result.error}`);
      process.exit(1);
    }
    await updateFeatureStatus(targetDir, storyFilter, "done", result.retries);
    let commitMessage: string | undefined;
    try {
      const commitRes = await commitStoryChanges(targetDir, storyFilter);
      if (commitRes.commitMessage) {
        commitMessage = commitRes.commitMessage;
        console.log(`📦 [Auto-Commit] ${commitRes.commitMessage}`);
      }
    } catch {}
    await appendSpecLedger(targetDir, storyFilter, [
      `done (triage 100/100, retries ${result.retries})`,
      ...(commitMessage ? [`commit: ${commitMessage}`] : [`commit: skipped (no changes)`]),
    ]);
    console.log(`✅ Story ${storyFilter} done — 5 fase lolos, triage 100/100, gap story↔source tertutup.`);
    return;
  }

  // Handle --epic
  if (epicFilter) {
    const epicStories = stories.filter(
      (s) => s.epic === epicFilter || s.epic?.toLowerCase() === epicFilter.toLowerCase()
    );
    if (epicStories.length === 0) {
      console.error(`❌ Epic ${epicFilter} not found`);
      process.exit(1);
    }
    // Get topological order filtered by epic, but respecting global DAG order
    const globalOrder = dag.sorted || [];
    const epicOrder = globalOrder.filter((id) => epicStories.some((s) => s.id === id));
    console.log(`\n📦 Epic ${epicFilter} — ${epicStories.length} stories in DAG order: ${epicOrder.join(" → ")}`);
    if (auto) {
      console.log(`🤖 Outer loop runner for epic ${epicFilter} — sequential per story with fresh process context`);
      console.log(`   Quality guarantee: 7→10 isolated reviewers per story with fresh subprocess context`);
      for (const sid of epicOrder) {
        const blocked = getBlockedStory(sid, stories, doneIds);
        if (blocked && !epicStories.some((s) => s.id === blocked)) {
          console.error(`🚫 Blocked: ${sid} depends on external dependency ${blocked} not done — stopping epic loop`);
          process.exit(1);
        }
        const st = statusMap.get(sid) || "backlog";
        console.log(`  • ${sid}: ${st} ${st === "done" ? "✅" : st === "in-progress" || st === "ready-for-dev" ? "▶️" : "⏳"}`);
      }
      const loopResult = await runEpicLoop({
        epicId: epicFilter,
        auto: true,
        targetDir,
        harness,
      });
      if (!loopResult.success) {
        console.error(`❌ Epic loop stopped: ${loopResult.message}`);
        process.exit(1);
      }
      console.log(`\n✅ Epic ${epicFilter} completed successfully: ${loopResult.completedStories.length}/${loopResult.totalStories} stories done.`);
    }
    return;
  }

  // Default: show next ready
  if (auto) {
    console.log(`🤖 Auto loop — checking next ready story in DAG order`);
    for (const sid of dag.sorted || []) {
      const st = statusMap.get(sid);
      const blocked = getBlockedStory(sid, stories, doneIds);
      if (!blocked && (st === "ready-for-atdd" || st === "ready-for-dev" || st === "in-progress" || st === "in-review" || st === "backlog")) {
        console.log(`▶️ Next story: ${sid} (status: ${st})`);
        break;
      }
    }
  }
}
async function handleGraphify(flags: string[]) {
  const targetDir = process.cwd();
  const blastArgIdx = flags.indexOf("--blast");
  let blastFile: string | null = null;
  if (blastArgIdx >= 0 && flags[blastArgIdx + 1]) blastFile = flags[blastArgIdx + 1];
  console.log(`\n🕸️ Running Graphify blast-radius in: ${targetDir}`);
  const { generateGraphFiles, getBlastRadius, buildGraph } = await import("./graphify");
  const res = await generateGraphFiles(targetDir);
  console.log(`✅ Generated ${path.relative(targetDir, res.jsonPath)} (${res.data.nodes.length} nodes, ${res.data.edges.length} edges) in ${res.data.stats.elapsed_ms}ms via ${res.data.stats.method}`);
  console.log(`✅ Generated ${path.relative(targetDir, res.htmlPath)}`);
  if (blastFile) {
    const blast = getBlastRadius(blastFile, res.data);
    console.log(`\n💥 Blast-radius for ${blastFile}:`);
    if (blast.affected.length === 0) console.log("  (none)");
    else for (const f of blast.affected) console.log(`  • ${f}`);
  } else {
    // Default example
    const blast = getBlastRadius("lib/accounts.ex", res.data);
    if (blast.affected.length > 0) {
      console.log(`\n💥 Example blast-radius lib/accounts.ex → ${blast.affected.length} terdampak: ${blast.affected.slice(0,5).join(", ")}${blast.affected.length>5?" …":""}`);
    }
  }
}

async function handleSweep(flags: string[]) {
  const targetDir = process.cwd();
  const dryRun = flags.includes("--dry-run");
  console.log(`\n🧹 Running Sweep (deferred P2 → ready-for-dev) in: ${targetDir}${dryRun?" [dry-run]":""}`);
  const { sweep, loadDeferredEntries } = await import("./sweep");
  const entries = await loadDeferredEntries(targetDir);
  console.log(`📋 Deferred entries: ${entries.length} (open P2: ${entries.filter(e=>e.status==="open"&&e.priority==="P2").length})`);
  const res = await sweep(targetDir, { dryRun });
  if (res.promoted.length === 0) {
    console.log("ℹ️ No entries promoted.");
  } else {
    console.log(`✅ Promoted ${res.promoted.length} to ready-for-dev: ${res.promoted.join(", ")}`);
  }
  if (res.alreadyReady.length > 0) console.log(`⏭️ Already ready: ${res.alreadyReady.join(", ")}`);
}

async function handleDoc(_flags: string[]) {
  const targetDir = process.cwd();
  console.log(`\n📚 Generating Diátaxis docs deterministically in: ${targetDir}`);
  const { generateDocs } = await import("./dokumentasi");
  const res = await generateDocs(targetDir);
  console.log(`✅ Docs generated: ${res.files.length} files across 4 quadrants`);
  for (const f of res.files) console.log(`  • ${path.relative(targetDir, f)}`);
  if (res.issues.length > 0) {
    console.log(`⚠️ ${res.issues.length} issues:`);
    for (const i of res.issues) console.log(`  • ${i}`);
  }
}

export async function handleInspect(flags: string[], repoRoot?: string) {
  const { handleInspect: runInspect } = await import("./inspeksi");
  return runInspect(flags, repoRoot);
}

export async function handleInspeksi(flags: string[], repoRoot?: string) {
  return handleInspect(flags, repoRoot);
}

export async function handleStory(flags: string[], repoRoot?: string) {
  const targetDir = repoRoot || process.cwd();
  let storyId: string | null = null;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f === "--dry-run") {
      dryRun = true;
    } else if (f === "--force") {
      force = true;
    } else if (f === "--story" && flags[i + 1]) {
      storyId = flags[i + 1];
      i++;
    } else if (f.startsWith("--story=")) {
      storyId = f.split("=")[1];
    } else if (!f.startsWith("-") && !storyId) {
      storyId = f;
    }
  }

  if (!storyId) {
    console.error("❌ Error: Story ID is required. Example: ompimpa story D-01");
    process.exit(1);
  }

  try {
    const result = await generateStorySpec(storyId, { repoRoot: targetDir, dryRun, force });

    console.log(`\n📝 JIT Story Spec Generator (/ompimpa:story) — H. Agus Salim (ompimpa-prd)`);
    console.log(`Story: ${result.storyId} (${result.epicId})`);
    if (dryRun) {
      console.log(`🔍 [DRY-RUN] Pratinjau spesifikasi untuk ${result.storyId}:\n`);
      console.log(result.content);
    } else {
      console.log(`✅ Generated JIT Spec: ${path.relative(targetDir, result.specFilePath)}`);
      const scenarioCount = (result.gherkinScenarios.match(/Scenario:/g) || []).length;
      console.log(`   • Skenario Gherkin: ${scenarioCount} skenario (TEA-01 ready)`);
      console.log(`   • Signatures: ${result.signatures.length} fungsi`);
      console.log(`   • Target Files: ${result.targetFiles.length} berkas implementasi`);
      console.log(`   • Test Files: ${result.testFiles.length} berkas uji ATDD`);
      console.log(`   • Blast Radius: ${result.blastRadius.method} (${result.blastRadius.affectedCallers.length} callers terdampak)`);
      await updateFeatureStatus(targetDir, result.storyId, "ready-for-atdd", 0);
      console.log(`   • Status: → ready-for-atdd (milestone spec-ready)`);
      console.log(`👉 Next step: Jalankan \`/atdd ${result.storyId}\` (Tuanku Imam Bonjol) untuk scaffolding tes merah.`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Error: ${msg}`);
    process.exit(1);
  }
}
function pathToElixirModuleName(filePath: string): string {
  const clean = filePath.replace(/^test\//, "").replace(/\.exs$/, "");
  const parts = clean.split("/").filter(Boolean);
  const moduleParts = parts.map((part) =>
    part
      .split("_")
      .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
      .join("")
  );
  const last = moduleParts[moduleParts.length - 1] || "StoryTest";
  if (!last.endsWith("Test")) {
    moduleParts[moduleParts.length - 1] = last + "Test";
  }
  return moduleParts.join(".");
}

async function scaffoldAtddTestFile(
  targetDir: string,
  testFile: string,
  story: StoryDetail
): Promise<void> {
  const fullPath = path.join(targetDir, testFile);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  if (testFile.endsWith(".exs")) {
    const moduleName = pathToElixirModuleName(testFile);
    const tests = (story.ac || [])
      .map(
        (ac: StoryAC) => `  @tag :tea_01
  test "${ac.id}: ${String(ac.given || "").slice(0, 30).replace(/"/g, "'")} -> ${String(ac.then || "").slice(0, 40).replace(/"/g, "'")}" do
    flunk("Red-Phase ATDD (TEA-01): ${ac.id} belum diimplementasikan - Given ${String(ac.given || "").replace(/"/g, '\\"')}, When ${String(ac.when || "").replace(/"/g, '\\"')}, Then ${String(ac.then || "").replace(/"/g, '\\"')}")
  end`
      )
      .join("\n\n");

    const content = `defmodule ${moduleName} do
  use ExUnit.Case, async: true
  @moduletag :atdd

  @moduledoc """
  Red-Phase ATDD untuk Story ${story.id}: ${story.title}
  Kriteria Penerimaan (TEA-01 Traceability):
${(story.ac || []).map((ac: StoryAC) => `  - ${ac.id}: Given ${ac.given} When ${ac.when} Then ${ac.then}`).join("\n")}

  Status: MERAH (failing by design) sampai fase koding menutup gap implementasi.
  """

${tests || '  test "placeholder failing test" do\n    flunk("Red-Phase ATDD belum diimplementasikan")\n  end'}
end
`;
    await fs.writeFile(fullPath, content, "utf-8");
  } else {
    // TypeScript / Bun test
    const tests = (story.ac || [])
      .map(
        (ac: StoryAC) => `  it("${ac.id}: Given ${String(ac.given || "").replace(/"/g, "'")} When ${String(ac.when || "").replace(/"/g, "'")} Then ${String(ac.then || "").replace(/"/g, "'")}", () => {
    expect.unreachable("Red-Phase ATDD (TEA-01): ${ac.id} belum diimplementasikan");
  });`
      )
      .join("\n\n");
    const content = `import { describe, it, expect } from "bun:test";

describe("Red-Phase ATDD Story ${story.id}: ${story.title} (@tea-01)", () => {
${tests || '  it("placeholder failing test", () => {\n    expect.unreachable("Red-Phase ATDD belum diimplementasikan");\n  });'}
});
`;
    await fs.writeFile(fullPath, content, "utf-8");
  }
}

export async function handleAtdd(flags: string[], repoRoot?: string): Promise<void> {
  const targetDir = repoRoot || process.cwd();
  let storyId: string | null = null;
  let autoScaffold = false;
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f === "--auto" || f === "--scaffold") {
      autoScaffold = true;
    } else if ((f === "--story" || f === "-s") && flags[i + 1]) {
      storyId = flags[i + 1];
      i++;
    } else if (f.startsWith("--story=")) {
      storyId = f.split("=")[1];
    } else if (!f.startsWith("-") && !storyId) {
      storyId = f;
    }
  }
  if (!storyId) {
    console.error("❌ Error: Story ID is required. Example: ompimpa atdd D-02");
    process.exit(1);
  }
  const specPath = path.join(targetDir, "_ompimpa", "specs", `SPEC-${storyId}.md`);
  if (!(await fileExists(specPath))) {
    console.error(`❌ Invariant Violation (INV-09): Berkas spesifikasi mikro belum ada di ${path.relative(targetDir, specPath)}.`);
    console.error(`👉 Jalankan 'ompimpa story ${storyId}' terlebih dahulu sebelum scaffolding ATDD.`);
    process.exit(1);
  }
  let testFiles: string[] = [];
  let acCount = 0;
  let storyDetail: StoryDetail | null = null;
  try {
    const { story } = await loadStoryDetail(storyId, targetDir);
    storyDetail = story;
    testFiles = partitionTargetFiles(story, targetDir).testFiles;
    acCount = story.ac.length;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Error: ${msg}`);
    process.exit(1);
  }
  const missing = [];
  for (const tf of testFiles) {
    if (!(await fileExists(path.join(targetDir, tf)))) missing.push(tf);
  }
  if (missing.length > 0) {
    if (autoScaffold) {
      console.log(`\n⚙️ Auto-scaffolding ${missing.length} missing Red-Phase ATDD test file(s) for ${storyId}...`);
      for (const tf of missing) {
        await scaffoldAtddTestFile(targetDir, tf, storyDetail);
        console.log(`   ✅ Created Red-Phase test: ${tf} (@moduletag :atdd, ${acCount} Gherkin failing assertions)`);
      }
    } else {
      console.error(`❌ Red-Phase ATDD belum lengkap untuk ${storyId}: ${missing.length} berkas tes belum di-scaffold.`);
      for (const m of missing) console.error(`   • hilang: ${m}`);
      console.error(`👉 Jalankan 'ompimpa atdd ${storyId} --auto' untuk scaffold otomatis, atau tugaskan Tuanku Imam Bonjol menulis tes MERAH.`);
      process.exit(1);
    }
  }
  await updateFeatureStatus(targetDir, storyId, "ready-for-dev", 0);
  console.log(`\n🔴 Red-Phase ATDD scaffold lengkap untuk ${storyId}: ${testFiles.length} berkas tes, ${acCount} AC.`);
  console.log(`   • Status: → ready-for-dev (milestone atdd-red)`);
  console.log(`👉 Next step: Jalankan '/code ${storyId}' hingga seluruh asersi hijau, lalu '/review ${storyId}'.`);
}

export async function handleInventory(flags: string[], repoRoot?: string): Promise<void> {
  const targetDir = repoRoot || process.cwd();
  let balairungFile: string | null = null;
  let prdFile: string | null = null;
  let storiesFile: string | null = null;
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f === "--balairung" && flags[i + 1]) {
      balairungFile = flags[i + 1];
      i++;
    } else if (f.startsWith("--balairung=")) {
      balairungFile = f.split("=")[1];
    } else if (f === "--prd" && flags[i + 1]) {
      prdFile = flags[i + 1];
      i++;
    } else if (f.startsWith("--prd=")) {
      prdFile = f.split("=")[1];
    } else if (f === "--stories" && flags[i + 1]) {
      storiesFile = flags[i + 1];
      i++;
    } else if (f.startsWith("--stories=")) {
      storiesFile = f.split("=")[1];
    } else if (!f.startsWith("-") && !balairungFile) {
      balairungFile = f;
    }
  }
  if (!balairungFile) {
    console.error("❌ Error: berkas risalah wajib. Example: ompimpa inventory --balairung _ompimpa/balairung/BALAIRUNG-*.md --prd _ompimpa/prd/PRD-*.md");
    process.exit(1);
  }
  const balairungPath = path.isAbsolute(balairungFile) ? balairungFile : path.join(targetDir, balairungFile);
  let risalah = "";
  try {
    risalah = await fs.readFile(balairungPath, "utf-8");
  } catch {
    console.error(`❌ Error: berkas Balairung tidak terbaca: ${balairungFile}`);
    process.exit(1);
  }
  const validation = validateBalairungInventory(risalah);
  if (!validation.ok) {
    console.error(`❌ Gerbang Inventaris GAGAL (${path.relative(targetDir, balairungPath)}): sidang belum boleh diketuk.`);
    for (const e of validation.errors) console.error(`   • ${e}`);
    process.exit(1);
  }
  console.log(`✅ Tabel Inventaris valid: ${validation.rows.length} modul terdaftar.`);
  if (prdFile) {
    const prdPath = path.isAbsolute(prdFile) ? prdFile : path.join(targetDir, prdFile);
    let extra = "";
    if (storiesFile) {
      const storiesPath = path.isAbsolute(storiesFile) ? storiesFile : path.join(targetDir, storiesFile);
      try {
        extra = await fs.readFile(storiesPath, "utf-8");
      } catch {
        console.error(`❌ Error: berkas stories tidak terbaca: ${storiesFile}`);
        process.exit(1);
      }
    }
    let prd = "";
    try {
      prd = await fs.readFile(prdPath, "utf-8");
    } catch {
      console.error(`❌ Error: berkas PRD tidak terbaca: ${prdFile}`);
      process.exit(1);
    }
    const coverage = checkPrdCoverage(validation.rows, prd, extra);
    if (!coverage.ok) {
      console.error(`❌ Scope-truncation terdeteksi: ${coverage.missing.length} modul inventaris hilang dari PRD.`);
      for (const m of coverage.missing) console.error(`   • hilang: ${m}`);
      console.error(`👉 Catat Scope Deferral Record di ADR atau kembalikan modul ke PRD sebelum /story.`);
      process.exit(1);
    }
    console.log(`✅ Cakupan PRD penuh: ${coverage.covered.length}/${validation.rows.length} modul tercakup.`);
  }
}


export async function handleCode(flags: string[], repoRoot?: string): Promise<void> {
  const targetDir = repoRoot || process.cwd();
  let storyId: string | null = null;
  let circuitBreakerMax = 3;

  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if ((f === "--story" || f === "-s") && flags[i + 1]) {
      storyId = flags[i + 1];
      i++;
    } else if (f.startsWith("--story=")) {
      storyId = f.split("=")[1];
    } else if (f === "--circuit-breaker" && flags[i + 1]) {
      circuitBreakerMax = parseInt(flags[i + 1], 10) || 3;
      i++;
    } else if (f.startsWith("--circuit-breaker=")) {
      circuitBreakerMax = parseInt(f.split("=")[1], 10) || 3;
    } else if (!f.startsWith("-") && !storyId) {
      storyId = f;
    }
  }

  if (!storyId) {
    console.error("❌ Error: Story ID is required. Example: ompimpa code D-02");
    process.exit(1);
  }

  // Validate INV-09: SPEC-[storyId].md must exist
  const specPath = path.join(targetDir, "_ompimpa", "specs", `SPEC-${storyId}.md`);
  const specExists = await fileExists(specPath);
  if (!specExists) {
    console.error(`❌ Invariant Violation (INV-09): Berkas spesifikasi mikro belum ada di ${path.relative(targetDir, specPath)}.`);
    console.error(`👉 Jalankan 'ompimpa story ${storyId}' terlebih dahulu sebelum memulai koding.`);
    process.exit(1);
  }

  console.log(`\n💻 OMP-IMPA Green-Phase Code Implementation (/code ${storyId})`);
  console.log(`Story: ${storyId}`);
  console.log(`Spec: ${path.relative(targetDir, specPath)} (INV-09 verified)`);
  console.log(`Circuit Breaker: Max ${circuitBreakerMax} retry cycles before human escalation`);
  console.log(`Stack Specialists: ompimpa-ash, ompimpa-ecto, ompimpa-liveview, ompimpa-oban, ompimpa-otp, ompimpa-ui`);
  console.log(`Scoped Test Rule: Run only targeted tests for active slice; full mix test is prohibited during coding.`);
  console.log(`👉 Next step: Setelah seluruh asersi hijau, jalankan '/review ${storyId}' (10 isolated reviewers).`);
}

export function printTriageHelp(): void {
  console.log(`
Usage: ompimpa triage <story-id> [options]

Run deterministic deduplication, Tier 2.5 Mini Balairung adjudication, and 100/100 scoring scorecard.

Options:
  --strict                         Exit with code 1 if verdict is not PASS
  --json                           Output result as JSON
  --story, -s <id>                 Specify story ID
  --adjudicate                     Force enable Tier 2.5 Mini Balairung adjudication
  --no-adjudicate                  Disable Tier 2.5 adjudication (use 0-token deterministic fallback)
  --adjudication-timeout-ms <n>    Adjudication timeout in milliseconds (default: 30000)
  --help, -h                       Show this help message
`);
}

export async function handleTriage(flags: string[], repoRoot?: string): Promise<void> {
  const targetDir = repoRoot || process.cwd();
  let storyId: string | null = null;
  let strict = false;
  let jsonOutput = false;
  let adjudicateOverride: boolean | null = null;
  let timeoutMsOverride: number | null = null;

  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f === "--help" || f === "-h") {
      printTriageHelp();
      return;
    } else if (f === "--strict") {
      strict = true;
    } else if (f === "--json") {
      jsonOutput = true;
    } else if (f === "--adjudicate") {
      adjudicateOverride = true;
    } else if (f === "--no-adjudicate") {
      adjudicateOverride = false;
    } else if (f === "--adjudication-timeout-ms" && flags[i + 1]) {
      timeoutMsOverride = parseInt(flags[i + 1], 10);
      i++;
    } else if (f.startsWith("--adjudication-timeout-ms=")) {
      timeoutMsOverride = parseInt(f.split("=")[1], 10);
    } else if ((f === "--story" || f === "-s") && flags[i + 1]) {
      storyId = flags[i + 1];
      i++;
    } else if (f.startsWith("--story=")) {
      storyId = f.split("=")[1];
    } else if (!f.startsWith("-") && !storyId) {
      storyId = f;
    }
  }

  if (!storyId) {
    console.error("❌ Error: Story ID is required. Example: ompimpa triage D-02");
    process.exit(1);
  }

  try {
    const reviewDir = path.join(targetDir, "_ompimpa", "review");
    const sessionMarker = await loadReviewSessionMarker(reviewDir, storyId);
    const result = await aggregateReviews(storyId, { targetDir, sessionMarker });

    const ompConfig = loadOmpimpaConfig(targetDir);
    const enableMiniBalairung =
      adjudicateOverride !== null
        ? adjudicateOverride
        : (ompConfig.quality?.triage?.enable_mini_balairung ?? true);
    const adjudicationTimeoutMs =
      timeoutMsOverride !== null
        ? timeoutMsOverride
        : (ompConfig.quality?.triage?.adjudication_timeout_ms ?? 30000);
    const adjudicationModel =
      ompConfig.quality?.triage?.adjudication_model || ompConfig.models?.triage || "smol";

    if (enableMiniBalairung) {
      const contested = detectContestedFindings(result.deduped);
      if (contested.length > 0) {
        if (!jsonOutput) {
          console.log(
            `⚖️ Mini Balairung (Tier 2.5): Mendeteksi ${contested.length} sengketa temuan review. Menjalankan adjudikasi model '${adjudicationModel}' (timeout ${adjudicationTimeoutMs}ms)...`
          );
        }
        const adjResult = await runAdjudicationTask(contested, storyId, {
          model: adjudicationModel,
          timeoutMs: adjudicationTimeoutMs,
          targetDir,
        });

        if (!adjResult.success || !adjResult.verdicts || adjResult.verdicts.length === 0) {
          const reason = adjResult.reason || "no verdicts";
          if (!jsonOutput) {
            console.log(`adjudication: fallback pessimistic (${reason})`);
          }
        } else {
          const adjudicatedFindings = applyAdjudicationResults(result.deduped, adjResult.verdicts);
          const updatedRejected = [
            ...result.rejected,
            ...adjudicatedFindings.filter((f) => (f.verdict || "").toLowerCase() === "false"),
          ];
          const updatedDeduped = adjudicatedFindings.filter(
            (f) => (f.verdict || "").toLowerCase() !== "false"
          );
          result.deduped = updatedDeduped;
          result.rejected = updatedRejected;
          result.score = calculateScore(updatedDeduped);
          result.remediation = remediationPlan(updatedDeduped);

          if (!jsonOutput) {
            console.log(
              `⚖️ Tier 2.5 Adjudikasi selesai: ${adjResult.verdicts.length} sengketa diselesaikan. Skor akhir: ${result.score.score}/100.`
            );
          }
        }
      }
    }

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
      if (result.score.verdict !== "PASS" && strict) {
        process.exit(1);
      }
      return;
    }

    console.log(`\n⚖️ OMP-IMPA Deterministic Triage (/triage ${storyId}) — Scorecard & Remediation`);
    console.log(`Story: ${storyId}`);
    console.log(`Score: ${result.score.score}/100 — Verdict: ${result.score.verdict === "PASS" ? "✅ PASS" : "🚫 REMEDIATE"}`);
    console.log(`Raw Findings: ${result.findings.length} | Deduped Findings: ${result.deduped.length}`);
    console.log(`Breakdown: P0/Critical: ${result.score.p0Count} (-30) | P1/High: ${result.score.p1Count} (-15) | P2/Medium-Low: ${result.score.p2Count}`);
    if (result.missing.length > 0) {
      console.log(`⚠️ Missing Reviewer Panels: ${result.missing.join(", ")} (penalized as P1 High)`);
    }

    if (result.remediation.length > 0) {
      console.log(`\n📋 Remediation Plan (Ordered P0 → P1 → P2):`);
      for (const item of result.remediation) {
        const fileLoc = item.file ? (item.line ? `${item.file}:${item.line}` : item.file) : "global";
        console.log(`  • [${item.severity}] ${item.ruleId} at ${fileLoc}: ${item.message || item.recommendation || item.rule_violation}`);
        if (item.recommendation) {
          console.log(`    ↳ Fix: ${item.recommendation}`);
        }
      }
    } else {
      console.log(`✨ Zero findings. Clean quality gate!`);
    }

    if (result.score.verdict !== "PASS") {
      console.log(`\n👉 Action: Jalankan perbaikan kode lalu lakukan re-review sebelum memanggil /triage kembali.`);
      if (strict) {
        process.exit(1);
      }
    } else {
      console.log(`\n👉 Next step: Siap untuk semantic commit dan pembaruan status ke done.`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Error during triage: ${msg}`);
    process.exit(1);
  }
}


/**
 * Read-only single observability surface: SPEC, tests, review evidence,
 * triage verdict, run ledger, git. Never writes.
 */
export async function handleStatus(flags: string[], repoRoot?: string): Promise<void> {
  const targetDir = repoRoot || process.cwd();
  let storyId: string | null = null;
  for (const f of flags) {
    if (!f.startsWith("-") && !storyId) storyId = f;
  }

  const storiesYamlPath = path.join(targetDir, "_ompimpa", "stories.yaml");
  const fallbackPath = path.join(targetDir, "_ompimpa", "status", "stories.yaml");
  let storiesContent: string | null = null;
  try {
    storiesContent = await fs.readFile(storiesYamlPath, "utf-8");
  } catch {
    try {
      storiesContent = await fs.readFile(fallbackPath, "utf-8");
    } catch {
      console.error(`❌ stories.yaml not found at ${storiesYamlPath}`);
      process.exit(1);
    }
  }
  const stories = parseStoriesYaml(storiesContent!);
  const statusPath = path.join(targetDir, "_ompimpa", "status", "feature-status.yaml");
  let statusContent = "";
  try {
    statusContent = await fs.readFile(statusPath, "utf-8");
  } catch {
    // empty
  }
  const { statusMap } = parseFeatureStatusYaml(statusContent);
  if (!storyId) {
    const counts: Record<string, number> = {};
    console.log(`\n📊 OMP-IMPA Status (kanban): ${stories.length} stories`);
    for (const s of stories) {
      const st = statusMap.get(s.id) || "backlog";
      counts[st] = (counts[st] || 0) + 1;
      const icon = st === "done" ? "✅" : st === "failed" ? "❌" : st === "backlog" ? "⏳" : "▶️";
      console.log(`  ${icon} ${s.id} [${s.epic}] ${st}`);
    }
    console.log(`\nSummary: ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(" | ")}`);
    return;
  }
  const story = stories.find((s) => s.id === storyId);
  if (!story) {
    console.error(`❌ Story ${storyId} not found in stories.yaml`);
    process.exit(1);
  }
  let storyTitle = storyId;
  let targetFiles: string[] = [];
  let testFiles: string[] = [];
  try {
    const detail = (await loadStoryDetail(storyId, targetDir)).story;
    storyTitle = detail.title || storyId;
    const parts = partitionTargetFiles(detail, targetDir);
    targetFiles = parts.targetFiles;
    testFiles = parts.testFiles;
  } catch {
    // story detail unreadable — laporkan apa adanya
  }
  const st = statusMap.get(storyId) || "backlog";
  console.log(`\n📋 Story ${storyId}: ${storyTitle}`);
  console.log(`   Epic: ${story.epic} | Status: ${st}`);
  const specRel = `_ompimpa/specs/SPEC-${storyId}.md`;
  const specExists = await fileExists(path.join(targetDir, specRel));
  console.log(`   SPEC: ${specRel} ${specExists ? "✅" : "❌ hilang"}`);

  for (const tf of testFiles) {
    console.log(`   Test: ${tf} ${await fileExists(path.join(targetDir, tf)) ? "✅" : "❌ hilang"}`);
  }

  const reviewDir = path.join(targetDir, "_ompimpa", "review");
  const config = loadOmpimpaConfig(targetDir);
  const panelIds = buildReviewPanel(config).map((m) => m.id);
  const marker = await loadReviewSessionMarker(reviewDir, storyId);
  const markerFiles = marker?.files || [];
  console.log(`   Review evidence: marker ${marker ? "✅ completed" : "❌ tanpa marker sesi"}`);
  for (const pid of panelIds) {
    const rel = `${storyId}-${pid}.json`;
    const full = path.join(reviewDir, rel);
    let state = "❌ hilang";
    if (await fileExists(full)) {
      try {
        const parsed: unknown = JSON.parse(await fs.readFile(full, "utf-8"));
        const envelopeClean = isEnvelopeCleanReport(parsed, storyId, pid);
        const inMarker = markerFiles.includes(rel);
        if (Array.isArray(parsed)) {
          state = parsed.length === 0 ? "⚠️ tanpa bukti (stub [])" : "⚠️ legacy (temuan tanpa envelope)";
        } else if (envelopeClean && inMarker) {
          state = "✅ terverifikasi";
        } else if (envelopeClean) {
          state = "⚠️ envelope tanpa marker sesi";
        } else {
          state = "⚠️ tanpa bukti";
        }
      } catch {
        state = "⚠️ tak terbaca";
      }
    }
    console.log(`     • ${pid}: ${state}`);
  }

  try {
    const triage = await aggregateReviews(storyId, { targetDir, sessionMarker: marker });
    console.log(`   Triage: ${triage.score.score}/100 ${triage.score.verdict} (P0:${triage.score.p0Count} P1:${triage.score.p1Count} P2:${triage.score.p2Count}, rejected:${triage.rejected.length})`);
    for (const r of triage.remediation.slice(0, 3)) {
      console.log(`     • [${r.severity}] ${r.ruleId} at ${r.file || "global"}${r.line ? `:${r.line}` : ""}`);
    }
    if (triage.remediation.length > 3) console.log(`     … +${triage.remediation.length - 3} temuan lain`);
  } catch {
    console.log(`   Triage: (gagal dihitung)`);
  }

  for (const role of ["dev", "review"] as const) {
    const logRel = `_ompimpa/runs/${storyId}-${role}.log`;
    const full = path.join(targetDir, logRel);
    if (!(await fileExists(full))) {
      console.log(`   Log ${role}: (belum ada sesi)`);
      continue;
    }
    try {
      const stat = await fs.stat(full);
      const content = await fs.readFile(full, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      const head = lines[0]?.startsWith("#") ? lines[0] : "";
      const tailLines = lines.filter((l) => !l.startsWith("#")).slice(-10);
      console.log(`   Log ${role}: ${logRel} (diubah ${stat.mtime.toISOString()}) ${head}`);
      for (const tl of tailLines) console.log(`     │ ${tl.slice(0, 160)}`);
    } catch {
      console.log(`   Log ${role}: (tak terbaca)`);
    }
  }

  try {
    const specContent = await fs.readFile(path.join(targetDir, specRel), "utf-8");
    const ledgerIdx = specContent.indexOf("## 12. Run Ledger");
    if (ledgerIdx >= 0) {
      const bullets = specContent
        .slice(ledgerIdx)
        .split("\n")
        .filter((l) => l.startsWith("- ["))
        .slice(-3);
      console.log(`   Run ledger:`);
      for (const b of bullets) console.log(`     ${b}`);
    } else {
      console.log(`   Run ledger: (kosong — belum ada vonis terminal)`);
    }
  } catch {
    console.log(`   Run ledger: (SPEC tidak terbaca)`);
  }

  const logRes = await runCommand("git", ["log", "--oneline", "-3", `--grep=${storyId}`], targetDir, true);
  const lastCommit = logRes.code === 0 ? logRes.stdout.trim().split("\n")[0] : "";
  console.log(`   Git commit: ${lastCommit || "(belum ada commit menyebut story ini)"}`);
  if (targetFiles.length > 0 || testFiles.length > 0) {
    const dirty = await runCommand("git", ["status", "--porcelain", "--", ...targetFiles, ...testFiles], targetDir, true);
    const dirtyLines = dirty.stdout.trim();
    console.log(`   Git worktree: ${dirtyLines ? "ada perubahan belum di-commit" : "bersih"}`);
    for (const dl of dirtyLines.split("\n").slice(0, 5)) {
      if (dl.trim()) console.log(`     ${dl.trim()}`);
    }
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("ompimpa error:", err);
    process.exit(1);
  });
}

async function handleTui(args: string[]): Promise<void> {
  let targetDir = process.cwd();
  let showThinking = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) {
      targetDir = args[i + 1];
      i++;
    } else if (args[i] === "--thinking") {
      showThinking = true;
    }
  }
  await runTui({ targetDir, showThinking });
}
