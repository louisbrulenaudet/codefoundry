import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCheck } from "../../src/cli/commands/check.ts";
import {
  applyPlan,
  availablePresets,
  nextSteps,
  planInit,
} from "../../src/cli/commands/init.ts";
import { detectRepository } from "../../src/cli/detect.ts";
import { run } from "../../src/cli/main.ts";
import {
  copyFixture,
  read,
  repoRoot,
  resultNamed,
  snapshotTree,
} from "../helpers/fixture.ts";

const schema = "https://json.schemastore.org/tsconfig";
const preset = (name: string): string =>
  `@codefoundry/tooling-config/typescript/${name}.json`;

/**
 * Runs this repository's oxfmt over generated files: a fresh init must already
 * be canonical.
 */
function expectFormatted(root: string, files: string[]): void {
  const oxfmt = path.join(repoRoot, "node_modules", ".bin", "oxfmt");
  const config = path.join(repoRoot, "oxfmt.config.ts");
  const result = spawnSync(oxfmt, ["--check", "-c", config, ...files], {
    cwd: root,
    encoding: "utf8",
  });
  expect(result.stdout + result.stderr).not.toContain("Format issues");
  expect(result.status).toBe(0);
}

describe("init on a fresh single package", () => {
  it("offers Node presets, writes thin adapters and the managed rules, then is a no-op", async () => {
    const root = copyFixture("fresh");
    const detection = detectRepository(root);
    expect(availablePresets(detection)).toEqual([
      "oxlint",
      "oxfmt",
      "tsconfig",
      "claude",
    ]);

    const plan = planInit(detection, availablePresets(detection));
    expect(plan.map((action) => [action.path, action.kind])).toEqual([
      ["oxlint.config.ts", "create"],
      ["oxfmt.config.ts", "create"],
      ["tsconfig.json", "create"],
      [".claude/rules/codefoundry", "update"],
    ]);

    const written = applyPlan(root, plan);
    expect(written).toContain("oxlint.config.ts");
    expect(written).toContain(".claude/rules/codefoundry/guardrails.md");
    expect(read(root, "oxlint.config.ts")).toBe(
      [
        'import { base, node } from "@codefoundry/tooling-config/oxlint";',
        'import { defineConfig } from "oxlint";',
        "",
        "export default defineConfig({",
        "  extends: [base, node],",
        "});",
        "",
      ].join("\n"),
    );
    expect(read(root, "oxfmt.config.ts")).toContain(
      "export default defineConfig(oxfmt);",
    );
    expect(JSON.parse(read(root, "tsconfig.json"))).toEqual({
      $schema: schema,
      extends: preset("library"),
      include: ["src/**/*.ts"],
    });
    expectFormatted(root, [
      "oxlint.config.ts",
      "oxfmt.config.ts",
      "tsconfig.json",
    ]);

    const before = snapshotTree(root);
    const secondPlan = planInit(
      detectRepository(root),
      availablePresets(detection),
    );
    expect(secondPlan.every((action) => action.kind === "exists")).toBe(true);
    expect(applyPlan(root, secondPlan)).toEqual([]);
    expect(await run(["init", "--yes"], { cwd: root })).toBe(0);
    expect(snapshotTree(root)).toEqual(before);

    const steps = nextSteps(detectRepository(root));
    expect(steps[0]).toBe(
      "Install the tools: pnpm add -D typescript oxlint oxlint-tsgolint oxfmt",
    );
  });
});

describe("init on a monorepo", () => {
  it("scopes the runtime presets to the detected apps and adds Syncpack", async () => {
    const root = copyFixture("monorepo");
    const tsconfigPlan = planInit(detectRepository(root), ["tsconfig"]);
    expect(tsconfigPlan.map((action) => [action.path, action.kind])).toEqual([
      ["apps/front-app/tsconfig.json", "exists"],
      ["apps/worker-api/tsconfig.json", "exists"],
      ["packages/lib/tsconfig.json", "exists"],
    ]);
    expect(await run(["init", "--yes"], { cwd: root })).toBe(0);

    const oxlint = read(root, "oxlint.config.ts");
    expect(oxlint).toContain(
      'import {\n  base,\n  react,\n  reactComponents,\n  tailwind,\n  worker,\n} from "@codefoundry/tooling-config/oxlint";',
    );
    expect(oxlint).toContain(
      '{ files: ["apps/worker-api/**/*.{ts,js,mjs}"], ...worker }',
    );
    expect(oxlint).toContain(
      '{ files: ["apps/front-app/src/**/*.{ts,tsx}"], ...react }',
    );
    expect(oxlint).toContain(
      '{ files: ["apps/front-app/src/**/*.tsx"], ...reactComponents }',
    );
    expect(oxlint).toContain(
      '{ files: ["apps/front-app/src/**/*.{ts,tsx}"], ...tailwind }',
    );
    expect(oxlint).toContain(
      'settings: {\n    "better-tailwindcss": { entryPoint: "apps/front-app/src/index.css" },\n  },',
    );
    expect(oxlint).not.toContain("node");

    expect(read(root, "oxfmt.config.ts")).toContain(
      'sortTailwindcss: { stylesheet: "apps/front-app/src/index.css" }',
    );
    expect(read(root, "syncpack.config.ts")).toBe(
      'import { syncpack } from "@codefoundry/tooling-config/syncpack";\n\nexport default syncpack;\n',
    );
    expect(read(root, "turbo.json")).toContain('"//#lint"');
    expectFormatted(root, [
      "oxlint.config.ts",
      "oxfmt.config.ts",
      "syncpack.config.ts",
    ]);
    expect(
      existsSync(path.join(root, ".claude/rules/codefoundry/testing.md")),
    ).toBe(true);
    expect(existsSync(path.join(root, "tsconfig.json"))).toBe(false);
  });
});

describe("init tsconfig scaffolding", () => {
  it("creates the preset-specific tsconfig files that are missing and leaves existing ones alone", async () => {
    const root = copyFixture("monorepo");
    rmSync(path.join(root, "apps/front-app/tsconfig.json"));
    rmSync(path.join(root, "apps/worker-api/tsconfig.json"));
    mkdirSync(path.join(root, "packages/lib/tests"));
    const libBefore = read(root, "packages/lib/tsconfig.json");
    expect(await run(["init", "--yes"], { cwd: root })).toBe(0);

    expect(JSON.parse(read(root, "apps/front-app/tsconfig.json"))).toEqual({
      $schema: schema,
      extends: "./tsconfig.app.json",
    });
    expect(JSON.parse(read(root, "apps/front-app/tsconfig.app.json"))).toEqual({
      $schema: schema,
      extends: preset("vite-react"),
      include: ["src/**/*.ts", "src/**/*.tsx"],
    });
    expect(JSON.parse(read(root, "apps/front-app/tsconfig.node.json"))).toEqual(
      {
        $schema: schema,
        extends: preset("vite-node"),
        include: ["vite.config.ts"],
      },
    );
    expect(JSON.parse(read(root, "apps/worker-api/tsconfig.json"))).toEqual({
      $schema: schema,
      extends: preset("workers"),
      include: ["src/**/*.ts"],
    });
    expect(read(root, "packages/lib/tsconfig.json")).toBe(libBefore);
    expect(JSON.parse(read(root, "packages/lib/tests/tsconfig.json"))).toEqual({
      $schema: schema,
      extends: ["../tsconfig.json", preset("tests")],
    });
    expect(existsSync(path.join(root, "tsconfig.json"))).toBe(false);
    expectFormatted(root, [
      "apps/front-app/tsconfig.json",
      "apps/front-app/tsconfig.app.json",
      "apps/front-app/tsconfig.node.json",
      "apps/worker-api/tsconfig.json",
      "packages/lib/tests/tsconfig.json",
    ]);
    expect(resultNamed(runCheck(root), "TypeScript presets")).toMatchObject({
      status: "ok",
      detail: "6/6 tsconfig files extend the shared presets",
    });
  });
});

describe("init with legacy JSON configs", () => {
  it("reports conflicts and never writes over or removes the legacy files", async () => {
    const root = copyFixture("legacy-json");
    const before = snapshotTree(root);
    const detection = detectRepository(root);
    const plan = planInit(detection, availablePresets(detection));
    const conflicts = plan
      .filter((action) => action.kind === "conflict")
      .map((action) => action.path);
    expect(conflicts).toEqual([
      ".oxlintrc.json",
      ".oxfmtrc.json",
      ".syncpackrc.json",
    ]);
    expect(plan.find((action) => action.path === "turbo.json")?.kind).toBe(
      "create",
    );

    expect(await run(["init", "--yes"], { cwd: root })).toBe(0);
    const after = snapshotTree(root);
    for (const file of conflicts) {
      expect(after[file]).toBe(before[file]);
    }
    expect(existsSync(path.join(root, "oxlint.config.ts"))).toBe(false);
    expect(existsSync(path.join(root, "turbo.json"))).toBe(true);
    expectFormatted(root, ["turbo.json"]);
  });
});
