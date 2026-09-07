import type { OxlintRules } from "./types.ts";

export const basePlugins = [
  "eslint",
  "typescript",
  "unicorn",
  "oxc",
  "import",
  "promise",
  "node",
  "vitest",
] as const;

export const coreRules: OxlintRules = {
  curly: ["error", "all"],
  "max-lines-per-function": [
    "error",
    { max: 100, skipBlankLines: true, IIFEs: true },
  ],
  "no-new-func": "error",
  "no-script-url": "error",
  "no-unreachable-loop": "error",
  "no-await-in-loop": "error",
  "no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      ignoreRestSiblings: true,
    },
  ],
};

export const typescriptRules: OxlintRules = {
  "typescript/no-explicit-any": "error",
  "typescript/no-non-null-assertion": "error",
  "typescript/no-unsafe-assignment": "error",
  "typescript/no-unsafe-member-access": "error",
  "typescript/no-unsafe-call": "error",
  "typescript/no-unsafe-return": "error",
  "typescript/parameter-properties": ["error", { prefer: "class-property" }],
  "typescript/switch-exhaustiveness-check": [
    "error",
    { considerDefaultExhaustiveForUnions: true },
  ],
  "typescript/prefer-literal-enum-member": "error",
  "typescript/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "separate-type-imports" },
  ],
  "typescript/consistent-type-exports": [
    "error",
    { fixMixedExportsWithInlineTypeSpecifier: true },
  ],
  "typescript/no-floating-promises": "error",
  "typescript/no-misused-promises": [
    "error",
    { checksVoidReturn: { attributes: false } },
  ],
  "typescript/await-thenable": "error",
  "typescript/require-await": "error",
  "typescript/only-throw-error": "error",
  "typescript/prefer-promise-reject-errors": "error",
  "typescript/use-unknown-in-catch-callback-variable": "error",
  "typescript/no-unnecessary-type-assertion": "error",
  "typescript/restrict-template-expressions": "error",
  "typescript/restrict-plus-operands": "error",
  "typescript/prefer-nullish-coalescing": "error",
  "typescript/prefer-optional-chain": "error",
  "typescript/no-unnecessary-condition": "error",
  "typescript/strict-void-return": "error",
  "typescript/no-deprecated": "error",
  "typescript/no-base-to-string": "error",
  "typescript/no-duplicate-type-constituents": "error",
  "typescript/no-redundant-type-constituents": "error",
  "typescript/no-unnecessary-type-parameters": "error",
  "typescript/non-nullable-type-assertion-style": "error",
  "typescript/consistent-type-assertions": "error",
  "typescript/no-meaningless-void-operator": "error",
  "typescript/prefer-reduce-type-parameter": "error",
  "typescript/prefer-find": "error",
  "typescript/prefer-includes": "error",
  "typescript/prefer-string-starts-ends-with": "error",
};

export const importRules: OxlintRules = {
  "import/no-cycle": ["error", { maxDepth: 10 }],
  "import/no-duplicates": "error",
  "import/no-mutable-exports": "error",
};

export const promiseRules: OxlintRules = {
  "promise/prefer-await-to-then": "error",
  "promise/no-return-wrap": "error",
  "promise/spec-only": "error",
};

export const unicornRules: OxlintRules = {
  "unicorn/no-empty-file": "off",
  "unicorn/no-useless-spread": "off",
  "unicorn/prefer-node-protocol": "error",
  "unicorn/explicit-timer-delay": "error",
  "unicorn/filename-case": ["error", { case: "kebabCase" }],
};

export const reactRules: OxlintRules = {
  "react/exhaustive-deps": "error",
  "react/no-array-index-key": "error",
  "react/rules-of-hooks": "error",
  "react/error-boundaries": "error",
  "react/globals": "error",
  "react/immutability": "error",
  "react/incompatible-library": "error",
  "react/preserve-manual-memoization": "error",
  "react/purity": "error",
  "react/refs": "error",
  "react/set-state-in-effect": "error",
  "react/set-state-in-render": "error",
  "react/static-components": "error",
  "react/use-memo": "error",
  "react/void-use-memo": "error",
  "react/no-danger": "error",
  "react/function-component-definition": [
    "error",
    {
      namedComponents: "function-declaration",
      unnamedComponents: "arrow-function",
    },
  ],
  "react-doctor/no-fetch-in-effect": "error",
  "react-doctor/no-derived-state": "error",
  "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
};

export const a11yRules: OxlintRules = {
  "jsx-a11y/anchor-is-valid": "error",
  "jsx-a11y/alt-text": "error",
};

export const tailwindRules: OxlintRules = {
  "better-tailwindcss/enforce-canonical-classes": "error",
  "better-tailwindcss/no-concatenated-classes": "error",
  "better-tailwindcss/no-conflicting-classes": "error",
  "better-tailwindcss/no-deprecated-classes": "error",
  "better-tailwindcss/no-duplicate-classes": "error",
  "better-tailwindcss/no-unknown-classes": "error",
  "better-tailwindcss/no-unnecessary-whitespace": "error",
};
