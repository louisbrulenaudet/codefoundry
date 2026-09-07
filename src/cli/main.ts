import path from "node:path";
import { parseArgs } from "node:util";
import { ownPackage } from "../versions.ts";
import { hasFailures } from "./checks.ts";
import { runCheck } from "./commands/check.ts";
import { runDoctor } from "./commands/doctor.ts";
import {
  applyPlan,
  availablePresets,
  nextSteps,
  planInit,
} from "./commands/init.ts";
import { runUpdate } from "./commands/update.ts";
import { detectRepository } from "./detect.ts";
import { exists } from "./fs.ts";
import * as ui from "./ui.ts";

export interface RunOptions {
  /** Repository root; defaults to --cwd or process.cwd(). */
  cwd?: string;
  /** Force prompts on or off; defaults to a TTY check unless --yes is passed. */
  interactive?: boolean;
}

const usage = `Usage: codefoundry <command> [options]

Commands:
  init      Adopt the CodeFoundry tooling in this repository
  doctor    Diagnose tool versions and configuration
  check     Validate the setup (deterministic, CI-friendly)
  update    Refresh the managed Claude Code rules

Options:
  -y, --yes        Do not prompt; accept every detected preset
      --cwd <dir>  Repository root (default: current directory)
  -h, --help       Show this help
  -v, --version    Print the package version

Exit codes: 0 ok, 1 problems found or cancelled, 2 usage error`;

function parseCli(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      options: {
        yes: { type: "boolean", short: "y", default: false },
        cwd: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    ui.error(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

async function runInit(root: string, interactive: boolean): Promise<number> {
  ui.intro("CodeFoundry Tooling");
  const detection = detectRepository(root);
  ui.note(ui.detectionLines(detection), "Detected");

  const available = availablePresets(detection);
  let presets = available;
  if (interactive) {
    const chosen = await ui.selectPresets(available);
    if (chosen === undefined) {
      ui.cancelled();
      return 1;
    }
    presets = chosen;
  }

  const plan = planInit(detection, presets);
  ui.showPlan(plan);
  const writes = plan.filter(
    (action) => action.kind === "create" || action.kind === "update",
  );
  if (writes.length === 0) {
    ui.outro(
      "Nothing to do - this repository already uses the CodeFoundry tooling.",
    );
    return 0;
  }
  if (
    interactive &&
    !(await ui.confirm(`Write ${String(writes.length)} item(s)?`))
  ) {
    ui.cancelled();
    return 1;
  }

  const written = applyPlan(root, plan);
  ui.note(written, "Written");
  ui.note(nextSteps(detectRepository(root)), "Next steps");
  ui.outro("Done.");
  return 0;
}

function report(title: string, results: ReturnType<typeof runCheck>): number {
  ui.intro(title);
  ui.showResults(results);
  const failed = hasFailures(results);
  ui.outro(failed ? "Issues detected." : "No issues detected.");
  return failed ? 1 : 0;
}

function runUpdateCommand(root: string): number {
  ui.intro("CodeFoundry Tooling Update");
  const { written, outdated } = runUpdate(root);
  ui.note(
    written.length > 0 ? written : ["Managed rules already up to date."],
    "Claude Code rules",
  );
  if (outdated.length > 0) {
    ui.showResults(outdated);
  }
  ui.outro(
    outdated.length > 0
      ? "Some tools are outside the supported range."
      : "Done.",
  );
  return outdated.length > 0 ? 1 : 0;
}

export async function run(
  argv: readonly string[],
  options: RunOptions = {},
): Promise<number> {
  const parsed = parseCli(argv);
  if (parsed === undefined) {
    ui.plain(usage);
    return 2;
  }
  if (parsed.values.version) {
    ui.plain(ownPackage.version);
    return 0;
  }
  const command = parsed.positionals[0];
  if (parsed.values.help || command === undefined) {
    ui.plain(usage);
    return 0;
  }
  const root = path.resolve(options.cwd ?? parsed.values.cwd ?? process.cwd());
  if (!exists(path.join(root, "package.json"))) {
    ui.error(
      `No package.json in ${root}. Run codefoundry from the repository root or pass --cwd <dir>.`,
    );
    return 2;
  }
  const interactive =
    options.interactive ??
    (!parsed.values.yes && process.stdin.isTTY && process.stdout.isTTY);

  try {
    switch (command) {
      case "init":
        return await runInit(root, interactive);
      case "doctor":
        return report("CodeFoundry Tooling Doctor", runDoctor(root));
      case "check":
        return report("CodeFoundry Tooling Check", runCheck(root));
      case "update":
        return runUpdateCommand(root);
      default:
        ui.error(`Unknown command: ${command}`);
        ui.plain(usage);
        return 2;
    }
  } catch (error) {
    ui.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
