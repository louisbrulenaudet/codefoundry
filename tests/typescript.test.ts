import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { copyFixture, repoRoot } from "./helpers/fixture.ts";

const presetsDir = path.join(repoRoot, "typescript");

interface Preset {
  extends?: string;
  compilerOptions?: Record<string, unknown>;
}

function readPreset(name: string): Preset {
  return JSON.parse(
    readFileSync(path.join(presetsDir, name), "utf8"),
  ) as Preset;
}

describe("typescript presets", () => {
  const names = readdirSync(presetsDir).toSorted();

  it("ships the six documented presets and exports each one", () => {
    expect(names).toEqual([
      "library.json",
      "strict.json",
      "tests.json",
      "vite-node.json",
      "vite-react.json",
      "workers.json",
    ]);
    const manifest = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ) as {
      exports: Record<string, string>;
    };
    const exported = names.map(
      (name) => manifest.exports[`./typescript/${name}`],
    );
    expect(exported).toEqual(names.map((name) => `./typescript/${name}`));
  });

  it("keeps the inheritance chain", () => {
    expect(readPreset("library.json").extends).toBe("./strict.json");
    expect(readPreset("workers.json").extends).toBe("./library.json");
    expect(readPreset("vite-react.json").extends).toBe("./strict.json");
    expect(readPreset("vite-node.json").extends).toBe("./strict.json");
    expect(readPreset("tests.json").extends).toBeUndefined();
    expect(readPreset("strict.json").compilerOptions).toMatchObject({
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      erasableSyntaxOnly: true,
    });
  });

  it("stays path-agnostic", () => {
    const offenders = names.filter((name) => {
      const options = readPreset(name).compilerOptions ?? {};
      const text = readFileSync(path.join(presetsDir, name), "utf8");
      const hardcodedBuildInfo =
        text.includes("tsBuildInfoFile") && !text.includes("${configDir}");
      return "paths" in options || "baseUrl" in options || hardcodedBuildInfo;
    });
    expect(offenders).toEqual([]);
  });

  it("typechecks a project that extends library.json with the real tsc", () => {
    const dir = copyFixture("fresh");
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        extends: path.join(presetsDir, "library.json"),
        include: ["src"],
      }),
    );
    mkdirSync(path.join(dir, "src"), { recursive: true });
    const tsc = path.join(repoRoot, "node_modules", ".bin", "tsc");
    const result = spawnSync(
      tsc,
      ["--noEmit", "-p", path.join(dir, "tsconfig.json")],
      {
        encoding: "utf8",
      },
    );
    expect(result.stdout + result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
