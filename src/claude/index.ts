import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const claudeRulesDir = fileURLToPath(
  new URL("../../claude/rules/", import.meta.url),
);

export interface ClaudeRule {
  name: string;
  path: string;
  sha256: string;
}

export function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export function listClaudeRules(): ClaudeRule[] {
  return readdirSync(claudeRulesDir)
    .filter((file) => file.endsWith(".md"))
    .toSorted()
    .map((name) => {
      const filePath = path.join(claudeRulesDir, name);
      return { name, path: filePath, sha256: sha256(readFileSync(filePath)) };
    });
}
