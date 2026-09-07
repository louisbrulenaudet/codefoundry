import { describe, expect, it } from "vitest";
import { runDoctor } from "../../src/cli/commands/doctor.ts";
import { run } from "../../src/cli/main.ts";
import {
  copyFixture,
  linkNodeModules,
  resultNamed,
} from "../helpers/fixture.ts";

describe("doctor", () => {
  it("checks the environment and reports tools that are missing", () => {
    const results = runDoctor(copyFixture("monorepo"));
    expect(resultNamed(results, "Node.js").status).toBe("ok");
    expect(resultNamed(results, "pnpm").status).toBe("ok");
    expect(resultNamed(results, "typescript")).toMatchObject({
      status: "fail",
      detail: "not installed",
      fix: "pnpm add -D -w typescript",
    });
    expect(resultNamed(results, "oxlint").status).toBe("skip");
  });

  it("passes for an initialised repository with the supported tool versions installed", async () => {
    const root = copyFixture("monorepo");
    linkNodeModules(root);
    expect(await run(["init", "--yes"], { cwd: root })).toBe(0);
    const results = runDoctor(root);
    expect(results.filter((entry) => entry.status === "fail")).toEqual([]);
    const tools = [
      "typescript",
      "oxlint",
      "oxlint-tsgolint",
      "oxfmt",
      "syncpack",
      "turbo",
      "vitest",
    ];
    expect(tools.map((tool) => resultNamed(results, tool).status)).toEqual(
      tools.map(() => "ok"),
    );
    expect(await run(["doctor"], { cwd: root })).toBe(0);
  });
});
