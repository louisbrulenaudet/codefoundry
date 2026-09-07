import type { CheckResult } from "../checks.ts";
import { runChecks } from "../checks.ts";
import { detectRepository } from "../detect.ts";

export function runCheck(root: string): CheckResult[] {
  return runChecks(detectRepository(root));
}
