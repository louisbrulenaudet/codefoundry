import { spawnSync } from "node:child_process";
import path from "node:path";
import semver from "semver";
import type { Detection } from "./detect.ts";
import { supportedVersions } from "../versions.ts";
import { configFile } from "./detect.ts";
import { readJson } from "./fs.ts";

export function installedVersion(
  root: string,
  name: string,
): string | undefined {
  const version = readJson(
    path.join(root, "node_modules", name, "package.json"),
  )?.["version"];
  return typeof version === "string" ? version : undefined;
}

export function satisfies(version: string, range: string): boolean {
  return semver.satisfies(version, range, { includePrerelease: true });
}

export function pnpmVersion(): string | undefined {
  const result = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    return undefined;
  }
  const version = result.stdout.trim();
  return semver.valid(version) === null ? undefined : version;
}

export interface RequiredTool {
  name: string;
  /** Whether the repository, as detected, needs this tool installed. */
  required: boolean;
  range: string | undefined;
}

/**
 * Which tool the repository needs when: the single table behind doctor, update
 * and init's next steps.
 */
export function requiredTools(detection: Detection): RequiredTool[] {
  const { existing } = detection;
  const oxlint = configFile(existing.oxlint) !== undefined;
  const table: Array<[string, boolean]> = [
    ["typescript", detection.typescript],
    ["oxlint", oxlint],
    ["oxlint-tsgolint", oxlint],
    ["oxfmt", configFile(existing.oxfmt) !== undefined],
    ["syncpack", configFile(existing.syncpack) !== undefined],
    ["turbo", detection.turbo],
    ["vitest", detection.vitest],
    ["@cloudflare/vitest-plugin", detection.worker && detection.vitest],
    ["oxlint-plugin-react-doctor", oxlint && detection.react],
    ["eslint-plugin-better-tailwindcss", oxlint && detection.tailwind],
  ];
  return table.map(([name, required]) => ({
    name,
    required,
    range: supportedVersions[name],
  }));
}

export function missingTools(detection: Detection): string[] {
  return requiredTools(detection)
    .filter(
      (tool) =>
        tool.required &&
        installedVersion(detection.root, tool.name) === undefined,
    )
    .map((tool) => tool.name);
}

export function pnpmAddCommand(
  detection: Detection,
  names: readonly string[],
): string {
  return `pnpm add -D ${detection.workspace ? "-w " : ""}${names.join(" ")}`;
}
