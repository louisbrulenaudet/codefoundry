import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { onTestFinished } from "vitest";
import type { CheckResult } from "../../src/cli/checks.ts";
import { sha256 } from "../../src/claude/index.ts";
import { toPosix } from "../../src/cli/fs.ts";

const fixturesDir = fileURLToPath(new URL("../../fixtures/", import.meta.url));
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Copies a fixture into a temp directory that is removed when the current test
 * finishes.
 */
export function copyFixture(name: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), `codefoundry-${name}-`));
  cpSync(path.join(fixturesDir, name), dir, { recursive: true });
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

/**
 * Points the fixture's node_modules at this repository's install so version
 * checks see real tools.
 */
export function linkNodeModules(dir: string): void {
  symlinkSync(
    path.join(repoRoot, "node_modules"),
    path.join(dir, "node_modules"),
    "dir",
  );
}

/**
 * Relative path to content hash for every file under `dir`, excluding
 * node_modules.
 */
export function snapshotTree(dir: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules") {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        entries[toPosix(path.relative(dir, full))] = sha256(readFileSync(full));
      }
    }
  };
  walk(dir);
  return entries;
}

export function read(dir: string, relativePath: string): string {
  return readFileSync(path.join(dir, relativePath), "utf8");
}

export function resultNamed(
  results: readonly CheckResult[],
  name: string,
): CheckResult {
  const found = results.find((entry) => entry.name === name);
  if (found === undefined) {
    throw new Error(`no result named ${name}`);
  }
  return found;
}
