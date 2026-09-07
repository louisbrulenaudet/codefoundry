import type { OxlintOverride } from "./types.ts";

const unsafeRulesOff = {
  "typescript/no-unsafe-assignment": "off",
  "typescript/no-unsafe-member-access": "off",
  "typescript/no-unsafe-call": "off",
  "typescript/no-unsafe-return": "off",
  "typescript/no-unsafe-type-assertion": "off",
} as const;

export const configFilesOverride: OxlintOverride = {
  files: [
    "**/scripts/**/*.{js,mjs,cjs}",
    "**/bin/**/*.{js,mjs,cjs}",
    "**/*.config.{js,mjs,cjs,ts,mts}",
    "**/vite.config.ts",
    "**/vitest.config.{ts,mts}",
  ],
  env: { node: true },
  rules: { ...unsafeRulesOff },
};

export const testsOverride: OxlintOverride = {
  files: [
    "**/*.test.{ts,tsx,js,jsx}",
    "**/*.spec.{ts,tsx,js,jsx}",
    "**/tests/**/*.{ts,tsx,js,jsx}",
    "**/vitest.setup.ts",
    "**/e2e/**/*.{ts,tsx,js,jsx}",
  ],
  env: { vitest: true, node: true },
  rules: {
    "max-lines-per-function": "off",
    "import/no-unassigned-import": [
      "error",
      { allow: ["**/*.css", "@testing-library/jest-dom/vitest"] },
    ],
    "typescript/no-explicit-any": "off",
    "typescript/no-non-null-assertion": "off",
    ...unsafeRulesOff,
    "vitest/require-to-throw-message": "off",
  },
};

export const evalOverride: OxlintOverride = {
  files: ["**/*.eval.ts"],
  rules: {
    "typescript/no-explicit-any": "off",
    ...unsafeRulesOff,
    "vitest/no-standalone-expect": "off",
  },
};
