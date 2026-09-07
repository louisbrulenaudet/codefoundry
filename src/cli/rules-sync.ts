import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { listClaudeRules, sha256 } from "../claude/index.ts";
import { exists, isDirectory, writeText } from "./fs.ts";

export const managedRulesDir = ".claude/rules/codefoundry";

export type RuleState = "ok" | "missing" | "stale" | "extra";

export interface RuleStatus {
  name: string;
  state: RuleState;
}

function stateOf(target: string, expectedHash: string): RuleState {
  if (!exists(target)) {
    return "missing";
  }
  return sha256(readFileSync(target)) === expectedHash ? "ok" : "stale";
}

export function rulesStatus(root: string): RuleStatus[] {
  const dir = path.join(root, managedRulesDir);
  const rules = listClaudeRules();
  const statuses: RuleStatus[] = rules.map((rule) => ({
    name: rule.name,
    state: stateOf(path.join(dir, rule.name), rule.sha256),
  }));
  if (isDirectory(dir)) {
    const known = new Set(rules.map((rule) => rule.name));
    for (const file of readdirSync(dir).toSorted()) {
      if (!known.has(file)) {
        statuses.push({ name: file, state: "extra" });
      }
    }
  }
  return statuses;
}

/**
 * Rules `syncRules` would write: missing from the managed directory or edited
 * locally.
 */
export function pendingRules(root: string): RuleStatus[] {
  return rulesStatus(root).filter(
    (status) => status.state === "missing" || status.state === "stale",
  );
}

/**
 * Copies missing and stale rules into the managed directory. Extra files are
 * left alone.
 */
export function syncRules(root: string): string[] {
  const written: string[] = [];
  for (const rule of listClaudeRules()) {
    const relativePath = `${managedRulesDir}/${rule.name}`;
    if (stateOf(path.join(root, relativePath), rule.sha256) === "ok") {
      continue;
    }
    writeText(root, relativePath, readFileSync(rule.path, "utf8"));
    written.push(relativePath);
  }
  return written;
}
