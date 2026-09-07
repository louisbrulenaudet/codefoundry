import { describe, expect, it, vi } from "vitest";
import { copyFixture, snapshotTree } from "../helpers/fixture.ts";

const cancelSymbol = Symbol("cancel");
vi.mock("@clack/prompts", () => ({
  intro: vi.fn<() => void>(),
  outro: vi.fn<() => void>(),
  note: vi.fn<() => void>(),
  cancel: vi.fn<() => void>(),
  log: {
    info: vi.fn<() => void>(),
    warn: vi.fn<() => void>(),
    error: vi.fn<() => void>(),
    step: vi.fn<() => void>(),
    message: vi.fn<() => void>(),
  },
  multiselect: vi.fn<() => Promise<unknown>>(() =>
    Promise.resolve(cancelSymbol),
  ),
  confirm: vi.fn<() => Promise<boolean>>(() => Promise.resolve(false)),
  isCancel: (value: unknown) => value === cancelSymbol,
}));

const { run } = await import("../../src/cli/main.ts");

describe("run", () => {
  it("prints usage and exits 0 without a command, 2 for usage errors", async () => {
    expect(await run([])).toBe(0);
    expect(await run(["--help"])).toBe(0);
    expect(await run(["--version"])).toBe(0);
    expect(await run(["--bogus"])).toBe(2);
    expect(await run(["frobnicate"], { cwd: process.cwd() })).toBe(2);
  });

  it("refuses to run outside a package root", async () => {
    const root = copyFixture("fresh");
    expect(await run(["check", "--cwd", `${root}/src`])).toBe(2);
    expect(await run(["check"], { cwd: `${root}/src` })).toBe(2);
  });

  it("writes nothing when the interactive prompt is cancelled", async () => {
    const root = copyFixture("fresh");
    const before = snapshotTree(root);
    expect(await run(["init"], { cwd: root, interactive: true })).toBe(1);
    expect(snapshotTree(root)).toEqual(before);
  });
});
