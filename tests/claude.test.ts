import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  claudeRulesDir,
  listClaudeRules,
  sha256,
} from "../src/claude/index.ts";

const leakMarkers = [
  "@repo/",
  "@monorepo/",
  "front-app",
  "worker-api",
  "apps/front-",
];

function frontmatterOf(text: string): string | undefined {
  if (!text.startsWith("---\n")) {
    return undefined;
  }
  const end = text.indexOf("\n---\n", 4);
  return end > 0 ? text.slice(4, end) : "";
}

describe("claude rules", () => {
  const rules = listClaudeRules();

  it("ships the organisation-wide rule set", () => {
    expect(rules.map((rule) => rule.name)).toEqual([
      "code-style.md",
      "comments.md",
      "dependencies.md",
      "guardrails.md",
      "markdown-style.md",
      "testing.md",
      "turborepo.md",
      "typescript-config.md",
    ]);
    expect(claudeRulesDir.endsWith("/claude/rules/")).toBe(true);
  });

  it("hashes match the shipped files", () => {
    const mismatched = rules.filter(
      (rule) => rule.sha256 !== sha256(readFileSync(rule.path)),
    );
    expect(mismatched).toEqual([]);
  });

  it("stays concise", () => {
    const long = rules.filter(
      (rule) => readFileSync(rule.path, "utf8").split("\n").length >= 60,
    );
    expect(long.map((rule) => rule.name)).toEqual([]);
  });

  it("uses a valid paths frontmatter when scoped", () => {
    const scoped = rules
      .map(
        (rule) =>
          [rule.name, frontmatterOf(readFileSync(rule.path, "utf8"))] as const,
      )
      .filter(
        (entry): entry is readonly [string, string] => entry[1] !== undefined,
      );
    expect(scoped.length).toBeGreaterThan(0);
    const invalid = scoped.filter(
      ([, frontmatter]) => !/^paths:\n(  - ".+"\n?)+$/.test(frontmatter),
    );
    expect(invalid.map(([name]) => name)).toEqual([]);
  });

  it("never names one repository's layout", () => {
    const leaks = rules.flatMap((rule) => {
      const text = readFileSync(rule.path, "utf8");
      return leakMarkers
        .filter((marker) => text.includes(marker))
        .map((marker) => `${rule.name}: ${marker}`);
    });
    expect(leaks).toEqual([]);
  });
});
