import type { OxfmtConfig } from "oxfmt";

export const oxfmt: OxfmtConfig = {
  useTabs: false,
  tabWidth: 2,
  printWidth: 80,
  endOfLine: "lf",
  insertFinalNewline: true,
  singleQuote: false,
  jsxSingleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "all",
  semi: true,
  arrowParens: "always",
  bracketSameLine: false,
  bracketSpacing: true,
  objectWrap: "preserve",
  proseWrap: "preserve",
  embeddedLanguageFormatting: "auto",
  jsdoc: true,
  sortPackageJson: { sortScripts: true },
  sortImports: {
    partitionByNewline: true,
    newlinesBetween: false,
    groups: [
      "type-import",
      ["value-builtin", "value-external"],
      "type-internal",
      "value-internal",
      ["type-parent", "type-sibling", "type-index"],
      ["value-parent", "value-sibling", "value-index"],
      "unknown",
    ],
  },
  ignorePatterns: [
    "**/node_modules/**",
    "**/*.gen.ts",
    "**/worker-configuration.d.ts",
    // package.json field order is owned by `syncpack format`, whose order differs from
    // oxfmt's sortPackageJson.
    "**/package.json",
    "**/*.md",
    "**/*.markdown",
    "**/*.mdx",
    "**/*.yaml",
    "**/*.yml",
    ".claude/**",
    ".agents/**",
    ".vscode/**",
    ".cursor/**",
  ],
};

export default oxfmt;
