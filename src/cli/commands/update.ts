import type { CheckResult } from "../checks.ts";
import { detectRepository } from "../detect.ts";
import { syncRules } from "../rules-sync.ts";
import { versionChecks } from "./doctor.ts";

export interface UpdateResult {
  written: string[];
  outdated: CheckResult[];
}

/**
 * Refreshes the managed Claude rules and lists tools outside their supported
 * range.
 */
export function runUpdate(root: string): UpdateResult {
  const written = syncRules(root);
  const outdated = versionChecks(detectRepository(root)).filter(
    (entry) => entry.status === "fail",
  );
  return { written, outdated };
}
