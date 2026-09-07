import type { CheckResult } from "../checks.ts";
import type { Detection } from "../detect.ts";
import { ownPackage } from "../../versions.ts";
import { result, runChecks } from "../checks.ts";
import { detectRepository } from "../detect.ts";
import {
  installedVersion,
  pnpmAddCommand,
  pnpmVersion,
  requiredTools,
  satisfies,
} from "../versions.ts";

/**
 * One result per tool the repository uses: installed and inside the supported
 * range.
 */
export function versionChecks(detection: Detection): CheckResult[] {
  return requiredTools(detection).map(({ name, required, range }) => {
    const installed = installedVersion(detection.root, name);
    if (installed === undefined) {
      return required
        ? result(
            name,
            "fail",
            "not installed",
            pnpmAddCommand(detection, [name]),
          )
        : result(name, "skip", "not installed (not used here)");
    }
    if (range !== undefined && !satisfies(installed, range)) {
      return result(
        name,
        "fail",
        `Installed: ${installed}\nRequired:  ${range}`,
        `pnpm update ${name}`,
      );
    }
    return result(name, "ok", installed);
  });
}

function environmentChecks(): CheckResult[] {
  const node = process.versions.node;
  const nodeRange = ownPackage.engines.node;
  const pnpm = pnpmVersion();
  return [
    satisfies(node, nodeRange)
      ? result("Node.js", "ok", node)
      : result(
          "Node.js",
          "fail",
          `Installed: ${node}\nRequired:  ${nodeRange}\nSwitch to the Node.js version in .nvmrc.`,
        ),
    pnpm === undefined
      ? result(
          "pnpm",
          "fail",
          "pnpm is not on PATH (https://pnpm.io/installation)",
        )
      : result("pnpm", "ok", pnpm),
  ];
}

export function runDoctor(root: string): CheckResult[] {
  const detection = detectRepository(root);
  return [
    ...environmentChecks(),
    ...versionChecks(detection),
    ...runChecks(detection),
  ];
}
