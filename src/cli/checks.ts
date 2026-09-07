import path from "node:path";
import type { AdapterTool, Detection } from "./detect.ts";
import { isRecord } from "../record.ts";
import { turboPolicyIssues } from "../turbo/index.ts";
import { packageName } from "../versions.ts";
import { referencesPackage } from "./adapters.ts";
import { adapterFiles, tsconfigNames, vitestConfigFiles } from "./detect.ts";
import { exists, readJsonc, readText } from "./fs.ts";
import { managedRulesDir, pendingRules, rulesStatus } from "./rules-sync.ts";

export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail?: string;
  /** A command that fixes the problem; explanations belong in `detail`. */
  fix?: string;
}

export function result(
  name: string,
  status: CheckStatus,
  detail?: string,
  fix?: string,
): CheckResult {
  const entry: CheckResult = { name, status };
  if (detail !== undefined) {
    entry.detail = detail;
  }
  if (fix !== undefined) {
    entry.fix = fix;
  }
  return entry;
}

export function hasFailures(results: readonly CheckResult[]): boolean {
  return results.some((entry) => entry.status === "fail");
}

function checkPackageManager(detection: Detection): CheckResult {
  const name = "pnpm workspace";
  switch (detection.packageManager) {
    case "pnpm":
      return result(
        name,
        "ok",
        detection.workspace ? "pnpm-workspace.yaml" : "single package",
      );
    case "unknown":
      return result(
        name,
        "warn",
        "no lockfile found yet; CodeFoundry repositories use pnpm",
        "pnpm install",
      );
    default:
      return result(
        name,
        "fail",
        `${detection.packageManager} lockfile found; CodeFoundry repositories use pnpm - migrate and remove the other lockfile`,
      );
  }
}

const adapterCheckNames: Record<AdapterTool, string> = {
  oxlint: "Oxlint config",
  oxfmt: "oxfmt config",
  syncpack: "Syncpack config",
};

function checkAdapter(detection: Detection, tool: AdapterTool): CheckResult {
  const name = adapterCheckNames[tool];
  const { script, legacy } = detection.existing[tool];
  if (script !== undefined && legacy !== undefined) {
    return result(
      name,
      "fail",
      `${script} and ${legacy} both exist; only one config file per directory is allowed. Move the remaining settings of ${legacy} into ${script}, then delete ${legacy}.`,
    );
  }
  if (script === undefined) {
    const detail =
      legacy === undefined
        ? `${adapterFiles[tool].target} is missing`
        : `${legacy} is a legacy config that does not use the shared policy`;
    return result(name, "fail", detail, "codefoundry init");
  }
  if (!referencesPackage(readText(path.join(detection.root, script)), tool)) {
    return result(
      name,
      "warn",
      `${script} does not import ${packageName}/${tool}`,
    );
  }
  return result(name, "ok", script);
}

function checkSyncpack(detection: Detection): CheckResult {
  if (!detection.workspace) {
    return result(
      "Syncpack config",
      "skip",
      "single package: no catalog policy to enforce",
    );
  }
  return checkAdapter(detection, "syncpack");
}

function checkTurbo(detection: Detection): CheckResult {
  const name = "Turborepo config";
  const file = detection.existing.turbo;
  if (file === undefined) {
    return result(name, "skip", "no turbo.json");
  }
  const { value, errors } = readJsonc(path.join(detection.root, file));
  if (errors.length > 0) {
    return result(
      name,
      "fail",
      `${file} cannot be parsed: ${errors[0] ?? "invalid JSON"}`,
    );
  }
  const issues = turboPolicyIssues(value);
  if (issues.length > 0) {
    const shown = issues.slice(0, 3).join("; ");
    const more =
      issues.length > 3 ? ` (+${String(issues.length - 3)} more)` : "";
    return result(
      name,
      "fail",
      `${file} diverges from the shared policy: ${shown}${more}. Align futureFlags and global with createTurboConfig() from ${packageName}/turbo.`,
    );
  }
  return result(name, "ok", file);
}

/**
 * Follows relative `extends` chains, so a split layout's `tsconfig.json` →
 * `./tsconfig.app.json` counts.
 */
function extendsSharedPresets(
  root: string,
  file: string,
  seen = new Set<string>(),
): boolean {
  const absolute = path.join(root, file);
  if (seen.has(absolute) || !exists(absolute)) {
    return false;
  }
  seen.add(absolute);
  const { value } = readJsonc(absolute);
  const parents = isRecord(value) ? value["extends"] : undefined;
  const entries = Array.isArray(parents) ? parents : [parents];
  return entries.some(
    (entry) =>
      typeof entry === "string" &&
      (entry.startsWith(`${packageName}/typescript/`) ||
        (entry.startsWith(".") &&
          extendsSharedPresets(
            root,
            path.join(path.dirname(file), entry),
            seen,
          ))),
  );
}

interface PackageFilesCheck {
  name: string;
  candidates: readonly string[];
  uses: (file: string) => boolean;
  /** Completes "no <noun>" (skip) and "no <noun> <warn>" (warn). */
  noun: string;
  warn: string;
  /** Completes "<n>/<m> <ok>". */
  ok: string;
}

function checkPackageFiles(
  detection: Detection,
  check: PackageFilesCheck,
): CheckResult {
  const files = detection.packages.flatMap((entry) =>
    check.candidates
      .map((name) => path.join(entry.dir, name))
      .filter((file) => exists(path.join(detection.root, file))),
  );
  if (files.length === 0) {
    return result(check.name, "skip", `no ${check.noun}`);
  }
  const using = files.filter((file) => check.uses(file));
  if (using.length === 0) {
    return result(check.name, "warn", `no ${check.noun} ${check.warn}`);
  }
  return result(
    check.name,
    "ok",
    `${String(using.length)}/${String(files.length)} ${check.ok}`,
  );
}

function checkClaudeRules(detection: Detection): CheckResult {
  const name = "Claude Code rules";
  const pending = pendingRules(detection.root);
  if (pending.length > 0) {
    const names = pending
      .map((entry) => `${entry.name} (${entry.state})`)
      .join(", ");
    return result(
      name,
      "fail",
      `${managedRulesDir}: ${names}`,
      "codefoundry update",
    );
  }
  const statuses = rulesStatus(detection.root);
  const extra = statuses.filter((entry) => entry.state === "extra");
  if (extra.length > 0) {
    return result(
      name,
      "warn",
      `${managedRulesDir} holds files not shipped by ${packageName}: ${extra.map((entry) => entry.name).join(", ")}. Move local rules to .claude/rules/ outside codefoundry/.`,
    );
  }
  return result(
    name,
    "ok",
    `${managedRulesDir} (${String(statuses.length)} files)`,
  );
}

/** Pure filesystem checks shared by `check` and `doctor`. */
export function runChecks(detection: Detection): CheckResult[] {
  return [
    checkPackageManager(detection),
    checkAdapter(detection, "oxlint"),
    checkAdapter(detection, "oxfmt"),
    checkSyncpack(detection),
    checkTurbo(detection),
    checkPackageFiles(detection, {
      name: "TypeScript presets",
      candidates: tsconfigNames,
      uses: (file) => extendsSharedPresets(detection.root, file),
      noun: "tsconfig.json",
      warn: `extends ${packageName}/typescript/*.json`,
      ok: "tsconfig files extend the shared presets",
    }),
    checkPackageFiles(detection, {
      name: "Vitest factories",
      candidates: vitestConfigFiles,
      uses: (file) =>
        referencesPackage(readText(path.join(detection.root, file)), "vitest"),
      noun: "vitest.config.ts",
      warn: `imports ${packageName}/vitest`,
      ok: "vitest configs use the shared factories",
    }),
    checkClaudeRules(detection),
  ];
}
