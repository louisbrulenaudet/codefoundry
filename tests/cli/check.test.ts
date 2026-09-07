import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasFailures } from "../../src/cli/checks.ts";
import { runCheck } from "../../src/cli/commands/check.ts";
import { runUpdate } from "../../src/cli/commands/update.ts";
import { run } from "../../src/cli/main.ts";
import { copyFixture, resultNamed } from "../helpers/fixture.ts";

describe("check", () => {
  it("fails on a repository that has not adopted the tooling", () => {
    const results = runCheck(copyFixture("fresh"));
    expect(resultNamed(results, "Oxlint config")).toMatchObject({
      status: "fail",
      fix: "codefoundry init",
    });
    expect(resultNamed(results, "Claude Code rules").status).toBe("fail");
    expect(resultNamed(results, "Syncpack config").status).toBe("skip");
    expect(hasFailures(results)).toBe(true);
  });

  it("passes after init, then catches turbo.json drift and stale rules until update fixes them", async () => {
    const root = copyFixture("monorepo");
    expect(await run(["init", "--yes"], { cwd: root })).toBe(0);

    const clean = runCheck(root);
    expect(clean.filter((entry) => entry.status === "fail")).toEqual([]);
    expect(resultNamed(clean, "Turborepo config").status).toBe("ok");
    expect(resultNamed(clean, "TypeScript presets").detail).toBe(
      "3/3 tsconfig files extend the shared presets",
    );
    expect(resultNamed(clean, "Vitest factories").status).toBe("ok");
    expect(await run(["check"], { cwd: root })).toBe(0);

    const turboPath = path.join(root, "turbo.json");
    writeFileSync(
      turboPath,
      readFileSync(turboPath, "utf8").replace(
        '"envMode": "strict"',
        '"envMode": "loose"',
      ),
    );
    const drifted = resultNamed(runCheck(root), "Turborepo config");
    expect(drifted.status).toBe("fail");
    expect(drifted.detail).toContain('global.envMode must be "strict"');

    const rulePath = path.join(root, ".claude/rules/codefoundry/comments.md");
    writeFileSync(rulePath, "# edited locally\n");
    const stale = resultNamed(runCheck(root), "Claude Code rules");
    expect(stale).toMatchObject({ status: "fail", fix: "codefoundry update" });
    expect(stale.detail).toContain("comments.md (stale)");
    expect(await run(["check"], { cwd: root })).toBe(1);

    const update = runUpdate(root);
    expect(update.written).toEqual([".claude/rules/codefoundry/comments.md"]);
    expect(resultNamed(runCheck(root), "Claude Code rules").status).toBe("ok");
  });

  it("reports malformed turbo.json as a failure instead of throwing", async () => {
    const root = copyFixture("malformed");
    const turbo = resultNamed(runCheck(root), "Turborepo config");
    expect(turbo.status).toBe("fail");
    expect(turbo.detail).toContain("turbo.json cannot be parsed");
    expect(await run(["check"], { cwd: root })).toBe(1);
  });

  it("flags coexisting JSON and TypeScript oxlint configs", async () => {
    const root = copyFixture("legacy-json");
    writeFileSync(
      path.join(root, "oxlint.config.ts"),
      'import { base } from "@codefoundry/tooling-config/oxlint";\nexport default base;\n',
    );
    const result = resultNamed(runCheck(root), "Oxlint config");
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("both exist");
    expect(await run(["check"], { cwd: root })).toBe(1);
  });
});
