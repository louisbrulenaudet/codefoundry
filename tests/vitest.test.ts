import { describe, expect, it } from "vitest";
import { defineNodeConfig, resolvePackageRoot } from "../src/vitest/index.ts";

describe("vitest factories", () => {
  it("defineNodeConfig applies the shared defaults and Node pool settings", () => {
    const config = defineNodeConfig();
    expect(config.test).toMatchObject({
      environment: "node",
      pool: "threads",
      isolate: false,
      include: ["tests/**/*.test.{ts,tsx}"],
      restoreMocks: true,
      clearMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
      passWithNoTests: true,
      fsModuleCache: true,
    });
    expect(config.test).not.toHaveProperty("reporters");
  });

  it("merges package overrides on top of the defaults", () => {
    const config = defineNodeConfig({
      root: "/pkg",
      test: { dir: "/pkg", passWithNoTests: false },
    });
    expect(config.root).toBe("/pkg");
    expect(config.test?.passWithNoTests).toBe(false);
    expect(config.test?.pool).toBe("threads");
  });

  it("resolvePackageRoot returns an absolute real path", () => {
    const root = resolvePackageRoot(import.meta.dirname);
    expect(root).toBe(import.meta.dirname);
  });
});
