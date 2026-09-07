import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectRepository,
  parseWorkspacePatterns,
} from "../../src/cli/detect.ts";
import { copyFixture } from "../helpers/fixture.ts";

const none = { script: undefined, legacy: undefined };

describe("detectRepository", () => {
  it("describes a fresh single package", () => {
    const detection = detectRepository(copyFixture("fresh"));
    expect(detection.workspace).toBe(false);
    expect(detection.packageManager).toBe("unknown");
    expect(detection.packages.map((entry) => entry.dir)).toEqual(["."]);
    expect(detection).toMatchObject({
      react: false,
      worker: false,
      vitest: false,
      turbo: false,
      tailwind: false,
    });
    expect(detection.existing).toEqual({
      oxlint: none,
      oxfmt: none,
      syncpack: none,
      turbo: undefined,
      managedRules: false,
    });
  });

  it("finds workspace packages, React, Tailwind, Workers, Vitest and Turbo in a monorepo", () => {
    const detection = detectRepository(copyFixture("monorepo"));
    expect(detection.packageManager).toBe("pnpm");
    expect(detection.workspace).toBe(true);
    expect(detection.workspacePatterns).toEqual(["apps/*", "packages/*"]);
    expect(detection.packages.map((entry) => entry.dir)).toEqual([
      ".",
      "apps/front-app",
      "apps/worker-api",
      "packages/lib",
    ]);
    const front = detection.packages.find(
      (entry) => entry.dir === "apps/front-app",
    );
    expect(front).toMatchObject({
      name: "front-app",
      react: true,
      vitest: true,
      worker: false,
      tsconfig: true,
      tailwindStylesheet: "apps/front-app/src/index.css",
    });
    expect(
      detection.packages.find((entry) => entry.dir === "apps/worker-api")
        ?.worker,
    ).toBe(true);
    expect(detection).toMatchObject({
      react: true,
      tailwind: true,
      worker: true,
      vitest: true,
      turbo: true,
      typescript: true,
    });
    expect(detection.existing.turbo).toBe("turbo.json");
  });

  it("does not treat a settings-only pnpm-workspace.yaml as a workspace", () => {
    const root = copyFixture("fresh");
    writeFileSync(
      path.join(root, "pnpm-workspace.yaml"),
      "allowBuilds:\n  esbuild: true\n",
    );
    const detection = detectRepository(root);
    expect(detection.workspace).toBe(false);
    expect(detection.workspacePatterns).toEqual([]);
  });

  it("reports legacy JSON configs", () => {
    const { existing } = detectRepository(copyFixture("legacy-json"));
    expect(existing.oxlint).toEqual({
      script: undefined,
      legacy: ".oxlintrc.json",
    });
    expect(existing.oxfmt.legacy).toBe(".oxfmtrc.json");
    expect(existing.syncpack.legacy).toBe(".syncpackrc.json");
  });
});

describe("parseWorkspacePatterns", () => {
  it("reads quoted and unquoted entries and ignores other keys", () => {
    const yaml = [
      "# comment",
      "packages:",
      "  - 'apps/*'",
      '  - "packages/*"',
      "  - tools/cli # inline comment",
      "  - '!**/test/**'",
      "catalog:",
      "  react: ^19.0.0",
    ].join("\n");
    expect(parseWorkspacePatterns(yaml)).toEqual([
      "apps/*",
      "packages/*",
      "tools/cli",
      "!**/test/**",
    ]);
    expect(parseWorkspacePatterns("catalog:\n  react: ^19.0.0\n")).toEqual([]);
  });
});
