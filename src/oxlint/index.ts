import type { OxlintConfig, OxlintPreset } from "./types.ts";
import {
  configFilesOverride,
  evalOverride,
  testsOverride,
} from "./overrides.ts";
import {
  a11yRules,
  basePlugins,
  coreRules,
  importRules,
  promiseRules,
  reactRules,
  tailwindRules,
  typescriptRules,
  unicornRules,
} from "./rules.ts";

export type { OxlintConfig, OxlintPreset } from "./types.ts";
export {
  a11yRules,
  basePlugins,
  coreRules,
  importRules,
  promiseRules,
  reactRules,
  tailwindRules,
  typescriptRules,
  unicornRules,
} from "./rules.ts";
export {
  configFilesOverride,
  evalOverride,
  testsOverride,
} from "./overrides.ts";

export const base: OxlintConfig = {
  env: { builtin: true },
  plugins: [...basePlugins],
  categories: {
    correctness: "error",
    suspicious: "error",
    pedantic: "off",
    style: "off",
    perf: "error",
    restriction: "off",
    nursery: "off",
  },
  // typeAware is honoured in the root config only; keep `base` in the root oxlint.config.ts.
  options: {
    typeAware: true,
    denyWarnings: true,
    reportUnusedDisableDirectives: "error",
    respectEslintDisableDirectives: false,
  },
  ignorePatterns: [
    "**/node_modules/**",
    "**/*.gen.ts",
    "**/worker-configuration.d.ts",
    ".claude/**",
    ".agents/**",
    ".vscode/**",
    ".cursor/**",
  ],
  rules: {
    ...coreRules,
    ...typescriptRules,
    ...importRules,
    ...promiseRules,
    ...unicornRules,
  },
  overrides: [configFilesOverride, testsOverride, evalOverride],
};

export const node: OxlintPreset = {
  env: { node: true },
};

export const worker: OxlintPreset = {
  env: { worker: true, serviceworker: true },
  globals: {
    ExecutionContext: "readonly",
    WebSocketPair: "readonly",
    HTMLRewriter: "readonly",
    D1Database: "readonly",
    KVNamespace: "readonly",
    R2Bucket: "readonly",
    Queue: "readonly",
    DurableObjectNamespace: "readonly",
    ServiceWorkerGlobalScope: "readonly",
  },
};

export const react: OxlintPreset = {
  env: { browser: true },
  plugins: [...basePlugins, "react", "jsx-a11y"],
  jsPlugins: ["oxlint-plugin-react-doctor"],
  rules: {
    ...reactRules,
    ...a11yRules,
    "max-lines-per-function": "off",
  },
};

// Scope this one to component files (`**/*.tsx`): PascalCase is allowed for components only,
// hooks and utilities stay kebab-case under `base`.
export const reactComponents: OxlintPreset = {
  rules: {
    "unicorn/filename-case": [
      "error",
      { cases: { kebabCase: true, pascalCase: true } },
    ],
  },
};

// Requires `settings["better-tailwindcss"].entryPoint` in the root config - a repository path.
export const tailwind: OxlintPreset = {
  jsPlugins: ["eslint-plugin-better-tailwindcss"],
  rules: { ...tailwindRules },
};

export default base;
