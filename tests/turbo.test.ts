import { describe, expect, it } from "vitest";
import {
  createTurboConfig,
  turboFutureFlags,
  turboGlobal,
  turboPolicyIssues,
} from "../src/turbo/index.ts";

describe("turbo policy", () => {
  it("creates a root turbo.json with the shared global settings and generic tasks only", () => {
    const config = createTurboConfig();
    expect(config.global).toEqual(turboGlobal);
    expect(config.futureFlags).toEqual(turboFutureFlags);
    expect(config.global.envMode).toBe("strict");
    expect(Object.keys(config.tasks)).toEqual(
      expect.arrayContaining([
        "transit",
        "check-types",
        "build",
        "test",
        "dev",
      ]),
    );
    for (const name of Object.keys(config.tasks)) {
      expect(name).not.toMatch(/^\/\/#/);
    }
    expect(config).not.toHaveProperty("boundaries");
    expect(JSON.stringify(config)).not.toContain("apps/");
  });

  it("returns a fresh object each time so callers can mutate safely", () => {
    const first = createTurboConfig();
    first.global.passThroughEnv.push("LOCAL_ONLY");
    expect(createTurboConfig().global.passThroughEnv).not.toContain(
      "LOCAL_ONLY",
    );
  });

  it("accepts its own output and local additions, and reports policy divergence", () => {
    const local = createTurboConfig();
    local.global.passThroughEnv.push("WRANGLER_SEND_METRICS");
    local.tasks["//#lint"] = { cache: false };
    expect(turboPolicyIssues(local)).toEqual([]);

    const loose = createTurboConfig();
    loose.global.envMode = "loose";
    loose.global.inputs = [];
    delete loose.futureFlags["globalConfiguration"];
    expect(turboPolicyIssues(loose)).toEqual([
      "futureFlags.globalConfiguration must be true (found undefined)",
      'global.envMode must be "strict" (found "loose")',
      'global.inputs must include "pnpm-workspace.yaml"',
    ]);
    expect(turboPolicyIssues(null).length).toBeGreaterThan(5);
  });
});
