import { defineConfig } from "oxfmt";
import { describe, expect, it } from "vitest";
import { oxfmt } from "../src/oxfmt/index.ts";

describe("oxfmt preset", () => {
  it("keeps the CodeFoundry formatting policy", () => {
    expect(oxfmt).toMatchObject({
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: false,
      trailingComma: "all",
      jsdoc: true,
      sortPackageJson: { sortScripts: true },
    });
    expect(oxfmt.sortImports).toMatchObject({
      partitionByNewline: true,
      newlinesBetween: false,
    });
  });

  it("leaves package.json to syncpack and skips markdown, yaml and agent directories", () => {
    for (const pattern of [
      "**/package.json",
      "**/*.md",
      "**/*.yaml",
      ".claude/**",
      "**/*.gen.ts",
    ]) {
      expect(oxfmt.ignorePatterns).toContain(pattern);
    }
  });

  it("carries no stylesheet path and spreads into defineConfig", () => {
    expect(oxfmt).not.toHaveProperty("sortTailwindcss");
    const local = defineConfig({
      ...oxfmt,
      sortTailwindcss: { stylesheet: "apps/web/src/index.css" },
    });
    expect(local.printWidth).toBe(80);
    expect(JSON.stringify(oxfmt)).not.toContain("apps/");
  });
});
