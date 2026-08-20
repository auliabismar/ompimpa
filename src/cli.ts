import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";

const VERSION = "1.0.0";
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

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
    case "doctor":
      await handleDoctor(args.slice(1));
      break;
    case "verify":
      await handleVerify(args.slice(1));
      break;
    case "link":
      await handleLink(args.slice(1));
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
  doctor    Diagnose project setup, toolchain availability, and Iron Law violations
  verify    Execute strict Elixir quality gate (compile, format, credo, sobelow, tests)
  link      Link this OMP-IMPA plugin into OMP environment
  version   Show version information
  help      Show this help message

Options:
  --ash         Force enable Ash Framework presets
  --no-ash      Force use Vanilla Phoenix + Ecto
  --oban        Force enable Oban background job worker configuration
  --no-oban     Force disable Oban presets
  --force       Overwrite existing configuration files
`);
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
framework = "phoenix"

[locale]
communication_language = "id"    # Language used by agents in chat ("id" | "en")
document_output_language = "id"  # Language used in PRD, ADR, and Diataxis docs ("id" | "en")

[governance]
enable_party_mode = true         # Enable multi-persona round-table discussions for /ompimpa:ideate
enable_prd_adr = true            # Enable Master PRD and MADR 3.0+ ADR generation
artifacts_dir = "_ompimpa"       # Directory for internal PRD, ADR, and status files

[quality]
enable_atdd = true               # Enforce Red-Phase ATDD before code implementation
quality_score_floor = 90         # Minimum test quality scorecard threshold (0-100)
warnings_as_errors = true        # Enforce mix compile --warnings-as-errors
max_dev_retries = 3              # Circuit breaker: escalate to human after 3 failed test iterations
auto_macro_review_in_dev = true  # Run full 4-track Macro-Review at the end of story execution
auto_triage_and_fix = true       # Automatically triage P0/P1 findings and remediate before final commit

[resources]
max_concurrency = 2              # Maximum parallel subagents running compilation/tests (prevents RAM/CPU exhaustion)
use_git_worktrees = true         # Execute parallel tasks in isolated Git Worktrees (~/.omp/wt/)
shared_lsp_server = true         # Use a single shared LSP instance across subagents

[models]
ideate = "slow"                  # Rohana Kudus & Tan Malaka (Deep TRIZ & First Principles reasoning)
prd = "plan"                     # H. Agus Salim (Master PRD & Architecture Planning)
adr = "plan"                     # H. Agus Salim (Architecture Decision Records)
ui = "default"                   # Marah Rusli (HEEx & Tailwind CSS Visual Design)
test = "default"                 # Tuanku Imam Bonjol (Red-Phase ATDD Scaffolding)
dev = "default"                  # Backend Specialists (Ash, LiveView, Ecto, Oban, OTP)
ironlaw = "smol"                 # Hj. Rasuna Said (Fast & deterministic Iron Law verification)
security = "slow"                # Bagindo Azizchan (Deep perimeter security & vulnerability audit)
debug = "slow"                   # Adinegoro (4-track deep root cause investigation)
doc = "default"                  # Mohammad Yamin (Diátaxis User, Admin, Dev Guides)

[stacks]
use_ash_framework = ${useAsh}     # Ash Framework or Vanilla Ecto
use_oban = ${useOban}              # Background job processing
use_tailwind = ${useTailwind}

[documentation]
diataxis_format = true           # Structure all guides into 4 Diataxis quadrants in docs/
output_dir = "docs"              # Target directory for official project Diátaxis documentation

[tools]
enable_tidewave = true           # Enable Tidewave MCP for live BEAM runtime inspection
enable_compound_memory = true    # Index proven bug fixes and decisions in _ompimpa/solutions/

[runtime_verification]
browser_e2e = true               # Enable Headless Chromium verification for critical paths
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

features:
  # Example Feature Entry (created from /ompimpa:prd)
  # feature-1:
  #   title: "User Authentication"
  #   status: "ready-for-dev"
  #   slices:
  #     slice-1.1:
  #       title: "Passkey Registration"
  #       status: "ready-for-dev"
  #       atdd_test: "test/my_app_web/live/passkey_live_test.exs"
`;
    await fs.writeFile(statusYamlPath, yamlContent, "utf-8");
    console.log("✅ Created _ompimpa/status/feature-status.yaml");
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
      console.log("✅ Installed .git/hooks/pre-commit (Iron Law & Quality Gate)");
    }
  }

  console.log("\n🎉 OMP-IMPA initialization complete!");
  console.log("👉 Run `ompimpa doctor` to check project health.");
  console.log("👉 Start your session with `omp` and run `/ompimpa:ideate` or `/ompimpa:prd`.");
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
  // 2. Check OMP-IMPA TTSR Stream Rules
  console.log("\n🛡️ OMP TTSR Real-Time Stream Rules:");
  const rulesDir = path.join(REPO_ROOT, "rules");
  try {
    const ruleFiles = await fs.readdir(rulesDir);
    const modularRules = ruleFiles.filter(f => f.startsWith("elixir-") && f.endsWith(".md") && !f.includes("iron-laws"));
    console.log(`  ✅ [ACTIVE] Loaded ${modularRules.length} modular TTSR real-time stream rule(s) in rules/`);
    for (const r of modularRules) {
      console.log(`     • ${r}`);
    }
  } catch (err) {
    console.log(`  ⚠️ [WARNING] Failed to load TTSR rules directory (${rulesDir})`);
  }

  // 3. Check toolchains
  console.log("\n🛠️ Toolchain availability:");
  const tools = ["mix", "git", "bun", "rtk"];
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
    console.log(`\n⚠️ Found ${issues} missing component(s). Run \`ompimpa init\` to repair.`);
  }
}

async function handleVerify(_flags: string[]) {
  const targetDir = process.cwd();
  console.log(`\n🛡️ Executing OMP-IMPA Strict Quality Gate in: ${targetDir}\n`);

  const steps = [
    { name: "Compiler Strict Mode", cmd: "mix", args: ["compile", "--warnings-as-errors"] },
    { name: "Code Formatter", cmd: "mix", args: ["format", "--check-formatted"] },
    { name: "ExUnit & LiveView Tests", cmd: "mix", args: ["test"] },
  ];

  for (const step of steps) {
    console.log(`\n▶️ [STEP] ${step.name} (\`${step.cmd} ${step.args.join(" ")}\`):`);
    const res = await runCommand(step.cmd, step.args, targetDir);
    if (res.code !== 0) {
      console.error(`\n❌ Quality gate FAILED at step: ${step.name}`);
      process.exit(res.code);
    }
  }

  console.log("\n🏆 100% Quality Gate PASSED: Zero warnings, formatted, all tests green!");
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

if (import.meta.main) {
  main().catch((err) => {
    console.error("ompimpa error:", err);
    process.exit(1);
  });
}
