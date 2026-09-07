import { defineConfig } from "oxlint";
import { describe, expect, it } from "vitest";
import {
  base,
  basePlugins,
  node,
  react,
  reactComponents,
  tailwind,
  worker,
} from "../src/oxlint/index.ts";

const presets = { base, node, react, reactComponents, tailwind, worker };

describe("oxlint presets", () => {
  it("base enables the CodeFoundry plugin set, categories and linter options", () => {
    expect(base.plugins).toEqual([...basePlugins]);
    expect(base.categories).toMatchObject({
      correctness: "error",
      suspicious: "error",
      perf: "error",
      pedantic: "off",
      style: "off",
      restriction: "off",
      nursery: "off",
    });
    expect(base.options).toEqual({
      typeAware: true,
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
      respectEslintDisableDirectives: false,
    });
    expect(base.env).toEqual({ builtin: true });
  });

  it("base keeps the strict TypeScript, import, promise and unicorn policy", () => {
    const rules = base.rules ?? {};
    for (const rule of [
      "typescript/no-explicit-any",
      "typescript/no-floating-promises",
      "typescript/switch-exhaustiveness-check",
      "import/no-cycle",
      "promise/prefer-await-to-then",
      "unicorn/prefer-node-protocol",
      "curly",
      "no-await-in-loop",
    ]) {
      const value = rules[rule];
      const severity = Array.isArray(value) ? value[0] : value;
      expect([rule, severity]).toEqual([rule, "error"]);
    }
    expect(rules["unicorn/no-empty-file"]).toBe("off");
    expect(rules["max-lines-per-function"]).toEqual([
      "error",
      { max: 100, skipBlankLines: true, IIFEs: true },
    ]);
  });

  it("base relaxes config files, tests and evals through overrides", () => {
    const overrides = base.overrides ?? [];
    expect(overrides).toHaveLength(3);
    const tests = overrides.find((entry) =>
      entry.files.some((glob) => glob.includes("*.test")),
    );
    expect(tests?.env).toEqual({ vitest: true, node: true });
    expect(tests?.rules?.["typescript/no-explicit-any"]).toBe("off");
    const configs = overrides.find((entry) =>
      entry.files.some((glob) => glob.includes("*.config")),
    );
    expect(configs?.env).toEqual({ node: true });
  });

  it("runtime presets carry only override-compatible keys", () => {
    for (const [name, preset] of Object.entries({
      node,
      react,
      reactComponents,
      tailwind,
      worker,
    })) {
      const keys = Object.keys(preset);
      expect([
        name,
        keys.filter((key) => ["files", "options", "settings"].includes(key)),
      ]).toEqual([name, []]);
    }
    expect(worker.globals).toHaveProperty("D1Database", "readonly");
    expect(react.plugins).toEqual([...basePlugins, "react", "jsx-a11y"]);
    expect(react.jsPlugins).toEqual(["oxlint-plugin-react-doctor"]);
    expect(react.rules?.["react/rules-of-hooks"]).toBe("error");
    expect(tailwind.jsPlugins).toEqual(["eslint-plugin-better-tailwindcss"]);
    expect(tailwind.rules?.["better-tailwindcss/no-unknown-classes"]).toBe(
      "error",
    );
    expect(reactComponents.rules?.["unicorn/filename-case"]).toEqual([
      "error",
      { cases: { kebabCase: true, pascalCase: true } },
    ]);
  });

  it("composes with oxlint's defineConfig as extends entries and override bodies", () => {
    const single = defineConfig({ extends: [base, node] });
    expect(single.extends).toHaveLength(2);
    const monorepo = defineConfig({
      extends: [base],
      overrides: [
        { files: ["apps/worker-api/**/*.ts"], ...worker },
        { files: ["apps/front-app/src/**/*.tsx"], ...react },
      ],
    });
    expect(monorepo.overrides[1]?.plugins).toContain("react");
  });

  it("contains no repository-specific paths", () => {
    const serialized = JSON.stringify(presets);
    for (const leak of [
      "apps/",
      "packages/",
      "front-app",
      "worker-api",
      "@repo/",
      "@monorepo/",
    ]) {
      expect(serialized.includes(leak) ? `leaked ${leak}` : "clean").toBe(
        "clean",
      );
    }
  });
});
