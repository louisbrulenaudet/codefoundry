import * as clack from "@clack/prompts";
import type { CheckResult } from "./checks.ts";
import type { PlannedAction, Preset } from "./commands/init.ts";
import type { Detection } from "./detect.ts";
import { configFile } from "./detect.ts";
import { managedRulesDir } from "./rules-sync.ts";

export function intro(title: string): void {
  clack.intro(title);
}

export function outro(message: string): void {
  clack.outro(message);
}

export function note(lines: readonly string[], title: string): void {
  clack.note(lines.join("\n"), title);
}

export function plain(text: string): void {
  process.stdout.write(`${text}\n`);
}

export function error(message: string): void {
  clack.log.error(message);
}

export function cancelled(): void {
  clack.cancel("Cancelled. Nothing was written.");
}

export function detectionLines(detection: Detection): string[] {
  const lines = [
    detection.workspace
      ? `pnpm workspace (${detection.workspacePatterns.join(", ")})`
      : "Single package",
  ];
  const packages = detection.packages.filter((entry) => entry.dir !== ".");
  if (packages.length > 0) {
    lines.push(`Packages: ${packages.map((entry) => entry.name).join(", ")}`);
  }
  const features: Array<[boolean, string]> = [
    [detection.typescript, "TypeScript"],
    [detection.react, "React"],
    [detection.tailwind, "Tailwind CSS"],
    [detection.worker, "Cloudflare Workers"],
    [detection.vitest, "Vitest"],
    [detection.turbo, "Turborepo"],
  ];
  lines.push(
    ...features.filter(([enabled]) => enabled).map(([, label]) => label),
  );
  const { existing } = detection;
  const found = [
    configFile(existing.oxlint),
    configFile(existing.oxfmt),
    configFile(existing.syncpack),
    existing.turbo,
    existing.managedRules ? managedRulesDir : undefined,
  ].filter((entry) => entry !== undefined);
  if (found.length > 0) {
    lines.push(`Existing config: ${found.join(", ")}`);
  }
  return lines;
}

const presetLabels: Record<Preset, string> = {
  oxlint: "Oxlint - oxlint.config.ts",
  oxfmt: "oxfmt - oxfmt.config.ts",
  syncpack: "Syncpack - syncpack.config.ts",
  turbo: "Turborepo - turbo.json with the shared policy",
  tsconfig:
    "TypeScript - tsconfig.json per package extending the shared presets",
  claude: `Claude Code rules - ${managedRulesDir}`,
};

export async function selectPresets(
  available: readonly Preset[],
): Promise<Preset[] | undefined> {
  const selection = await clack.multiselect<Preset>({
    message: "Which CodeFoundry presets should be enabled?",
    options: available.map((value) => ({ value, label: presetLabels[value] })),
    initialValues: [...available],
    required: false,
  });
  return clack.isCancel(selection) ? undefined : selection;
}

export async function confirm(message: string): Promise<boolean> {
  const answer = await clack.confirm({ message });
  return answer === true;
}

const actionVerbs: Record<PlannedAction["kind"], string> = {
  create: "create  ",
  exists: "exists  ",
  conflict: "conflict",
  update: "update  ",
};

export function showPlan(plan: readonly PlannedAction[]): void {
  for (const action of plan) {
    const line = `${actionVerbs[action.kind]} ${action.path}`;
    const text = action.note === undefined ? line : `${line}\n${action.note}`;
    if (action.kind === "conflict") {
      clack.log.warn(text);
    } else if (action.kind === "exists") {
      clack.log.info(`${line} (unchanged)`);
    } else {
      clack.log.step(text);
    }
  }
}

const statusSymbols: Record<CheckResult["status"], string> = {
  ok: "✓",
  warn: "!",
  fail: "✗",
  skip: "-",
};

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

export function showResults(results: readonly CheckResult[]): void {
  for (const entry of results) {
    const parts = [entry.name];
    if (entry.status === "ok" || entry.status === "skip") {
      if (entry.detail !== undefined) {
        parts[0] = `${entry.name}  ${entry.detail}`;
      }
    } else {
      if (entry.detail !== undefined) {
        parts.push(indent(entry.detail));
      }
      if (entry.fix !== undefined) {
        parts.push(indent(`Run:\n  ${entry.fix}`));
      }
    }
    clack.log.message(parts.join("\n"), {
      symbol: statusSymbols[entry.status],
    });
  }
}
