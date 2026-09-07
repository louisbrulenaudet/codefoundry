import path from "node:path";
import type { GeneratedFile } from "../adapters.ts";
import type { Detection, ExistingConfig } from "../detect.ts";
import { packageName } from "../../versions.ts";
import {
  oxfmtAdapter,
  oxlintAdapter,
  syncpackAdapter,
  tsconfigFiles,
  turboAdapter,
} from "../adapters.ts";
import { adapterFiles } from "../detect.ts";
import { exists, writeText } from "../fs.ts";
import { managedRulesDir, pendingRules, syncRules } from "../rules-sync.ts";
import { missingTools, pnpmAddCommand } from "../versions.ts";

export type Preset =
  | "oxlint"
  | "oxfmt"
  | "syncpack"
  | "turbo"
  | "tsconfig"
  | "claude";

export type ActionKind = "create" | "exists" | "conflict" | "update";

export interface PlannedAction {
  preset: Preset;
  path: string;
  kind: ActionKind;
  content?: string;
  note?: string;
}

export function availablePresets(detection: Detection): Preset[] {
  const presets: Preset[] = ["oxlint", "oxfmt"];
  if (detection.workspace) {
    presets.push("syncpack");
  }
  // Turbo is a monorepo tool: offer it for workspaces, or to verify an existing turbo.json.
  if (detection.workspace || detection.existing.turbo !== undefined) {
    presets.push("turbo");
  }
  presets.push("tsconfig", "claude");
  return presets;
}

function planFile(
  preset: Preset,
  target: string,
  existing: ExistingConfig,
  content: string,
): PlannedAction {
  if (existing.script !== undefined) {
    return { preset, path: existing.script, kind: "exists" };
  }
  if (existing.legacy !== undefined) {
    return {
      preset,
      path: existing.legacy,
      kind: "conflict",
      note: `${existing.legacy} is a legacy config. Move its repository-specific parts into ${target} on top of the shared policy, then delete ${existing.legacy}. codefoundry never edits or removes it.`,
    };
  }
  return { preset, path: target, kind: "create", content };
}

function planGenerated(
  root: string,
  preset: Preset,
  file: GeneratedFile,
): PlannedAction {
  const script = exists(path.join(root, file.path)) ? file.path : undefined;
  return planFile(
    preset,
    file.path,
    { script, legacy: undefined },
    file.content,
  );
}

/**
 * One action per tsconfig file; a package with its own tsconfig.json only gets
 * the tests mixin.
 */
function planTsconfigs(detection: Detection): PlannedAction[] {
  const packages = detection.workspace
    ? detection.packages.filter((entry) => entry.dir !== ".")
    : detection.packages;
  return packages.flatMap((entry) => {
    const files = tsconfigFiles(detection.root, entry);
    const wanted = entry.tsconfig
      ? files.filter(
          (file, index) =>
            index === 0 || file.path.endsWith("tests/tsconfig.json"),
        )
      : files;
    return wanted.map((file) =>
      planGenerated(detection.root, "tsconfig", file),
    );
  });
}

function planClaudeRules(detection: Detection): PlannedAction {
  const pending = pendingRules(detection.root);
  if (pending.length === 0) {
    return { preset: "claude", path: managedRulesDir, kind: "exists" };
  }
  return {
    preset: "claude",
    path: managedRulesDir,
    kind: "update",
    note: `${String(pending.length)} managed rule file(s): ${pending.map((entry) => entry.name).join(", ")}`,
  };
}

export function planInit(
  detection: Detection,
  presets: readonly Preset[],
): PlannedAction[] {
  const { existing } = detection;
  const planners: Record<Preset, () => PlannedAction[]> = {
    oxlint: () => [
      planFile(
        "oxlint",
        adapterFiles.oxlint.target,
        existing.oxlint,
        oxlintAdapter(detection),
      ),
    ],
    oxfmt: () => [
      planFile(
        "oxfmt",
        adapterFiles.oxfmt.target,
        existing.oxfmt,
        oxfmtAdapter(detection),
      ),
    ],
    syncpack: () => [
      planFile(
        "syncpack",
        adapterFiles.syncpack.target,
        existing.syncpack,
        syncpackAdapter(),
      ),
    ],
    turbo: () => [
      planFile(
        "turbo",
        "turbo.json",
        { script: existing.turbo, legacy: undefined },
        turboAdapter(),
      ),
    ],
    tsconfig: () => planTsconfigs(detection),
    claude: () => [planClaudeRules(detection)],
  };
  return presets.flatMap((preset) => planners[preset]());
}

function assertValidContent(action: PlannedAction): string {
  const { content, path: target } = action;
  if (content === undefined || content.trim() === "") {
    throw new Error(`Internal error: empty content generated for ${target}`);
  }
  if (target.endsWith(".json")) {
    JSON.parse(content);
  } else if (!content.includes(packageName)) {
    throw new Error(
      `Internal error: ${target} does not reference ${packageName}`,
    );
  }
  return content;
}

/**
 * Writes every `create` action and syncs the managed rules for `update`.
 * Returns written paths.
 */
export function applyPlan(
  root: string,
  plan: readonly PlannedAction[],
): string[] {
  const written: string[] = [];
  for (const action of plan) {
    if (action.kind === "create") {
      writeText(root, action.path, assertValidContent(action));
      written.push(action.path);
    } else if (action.kind === "update") {
      written.push(...syncRules(root));
    }
  }
  return written;
}

/**
 * Guidance after `init`, computed from the repository state once the plan has
 * been applied.
 */
export function nextSteps(detection: Detection): string[] {
  const steps: string[] = [];
  const missing = missingTools(detection);
  if (missing.length > 0) {
    steps.push(`Install the tools: ${pnpmAddCommand(detection, missing)}`);
    if (detection.workspace) {
      steps.push(
        "Add them to the catalog in pnpm-workspace.yaml first so syncpack accepts the catalog: specifier.",
      );
    }
  }
  if (detection.vitest) {
    steps.push(
      `Build each vitest.config.ts with defineNodeConfig or defineWorkersConfig from ${packageName}/vitest.`,
    );
  }
  steps.push(
    "Run codefoundry doctor to verify the setup, and add codefoundry check to CI.",
  );
  return steps;
}
