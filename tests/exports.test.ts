import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./helpers/fixture.ts";

interface Manifest {
  exports: Record<string, string>;
  files: string[];
  bin: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
) as Manifest;

describe("package exports", () => {
  it("point at files that exist after a build, with declarations beside every module", () => {
    const missing = Object.entries(manifest.exports).flatMap(
      ([subpath, target]) => {
        const declaration = target.endsWith(".js")
          ? target.replace(/\.js$/, ".d.ts")
          : target;
        return [target, declaration]
          .filter((file) => !existsSync(path.join(repoRoot, file)))
          .map((file) => `${subpath} -> ${file}`);
      },
    );
    expect(missing).toEqual([]);
    expect(
      existsSync(path.join(repoRoot, manifest.bin["codefoundry"] ?? "")),
    ).toBe(true);
  });

  it("expose only the public surface", () => {
    const subpaths = Object.keys(manifest.exports);
    expect(subpaths.filter((entry) => entry.includes("cli"))).toEqual([]);
    expect(manifest.files).toEqual([
      "bin",
      "lib",
      "typescript",
      "claude",
      "CHANGELOG.md",
    ]);
  });

  it("load from the built output", async () => {
    const built: unknown = await import(
      path.join(repoRoot, manifest.exports["."] ?? "")
    );
    expect(built).toHaveProperty("base");
    expect(built).toHaveProperty("syncpack");
    expect(built).toHaveProperty("createTurboConfig");
    expect(built).toHaveProperty("supportedVersions");
  });
});
