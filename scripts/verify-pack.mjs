// Packs the package, installs the tarball into a temp consumer and exercises it exactly as a
// downstream repository would: init, check, every export subpath, oxlint, oxfmt and tsc.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);
const work = mkdtempSync(path.join(os.tmpdir(), "codefoundry-pack-"));
const storeDir = path.join(root, ".pnpm-store");

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @param {string} [cwd]
 * @returns {string}
 */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

/**
 * @param {unknown} condition
 * @param {string} message
 * @returns {asserts condition}
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  assert(
    existsSync(path.join(root, "lib", "index.js")),
    "lib/ is missing - run `pnpm build` (or `pnpm test`) first",
  );
  run("pnpm", ["pack", "--pack-destination", work], root);
  const tarball = readdirSync(work).find((file) => file.endsWith(".tgz"));
  assert(tarball, "pnpm pack produced no tarball");

  const entries = run("tar", ["-tzf", path.join(work, tarball)])
    .trim()
    .split("\n");
  for (const required of [
    "package/package.json",
    "package/README.md",
    "package/LICENSE",
    "package/CHANGELOG.md",
    "package/bin/codefoundry.js",
    "package/lib/index.js",
    "package/lib/index.d.ts",
    "package/lib/cli/main.js",
    "package/typescript/strict.json",
    "package/typescript/tests.json",
    "package/claude/rules/guardrails.md",
  ]) {
    assert(entries.includes(required), `tarball is missing ${required}`);
  }
  for (const forbidden of [
    /^package\/src\//,
    /^package\/tests\//,
    /^package\/fixtures\//,
    /^package\/scripts\//,
    /^package\/tsconfig/,
    /\.tsbuildinfo$/,
  ]) {
    const leaked = entries.find((entry) => forbidden.test(entry));
    assert(leaked === undefined, `tarball contains development file ${leaked}`);
  }
  console.log(`tarball ok (${entries.length} files)`);

  const consumer = path.join(work, "consumer");
  cpSync(path.join(root, "fixtures", "fresh"), consumer, { recursive: true });
  run(
    "pnpm",
    [
      "add",
      "-D",
      "--store-dir",
      storeDir,
      path.join(work, tarball),
      "oxlint",
      "oxlint-tsgolint",
      "oxfmt",
      "typescript",
      "vitest",
    ],
    consumer,
  );
  console.log("installed into consumer");

  const bin = path.join(consumer, "node_modules", ".bin", "codefoundry");
  assert(
    run(bin, ["--version"], consumer).trim() === manifest.version,
    "bin --version mismatch",
  );
  run(bin, ["init", "--yes"], consumer);
  run(bin, ["check"], consumer);
  console.log("init + check ok");

  const subpaths = Object.keys(manifest.exports).filter(
    (entry) => !entry.endsWith(".json") && entry !== "./vitest/workers",
  );
  const script = subpaths
    .map(
      (entry) =>
        `await import(${JSON.stringify(manifest.name + entry.slice(1))});`,
    )
    .join("\n");
  run(process.execPath, ["--input-type=module", "-e", script], consumer);
  console.log(`exports ok (${subpaths.length} subpaths)`);

  run(path.join(consumer, "node_modules", ".bin", "oxlint"), [], consumer);
  run(
    path.join(consumer, "node_modules", ".bin", "oxfmt"),
    ["--check"],
    consumer,
  );
  run(
    path.join(consumer, "node_modules", ".bin", "tsc"),
    ["--noEmit", "-p", "tsconfig.json"],
    consumer,
  );
  console.log("oxlint, oxfmt and tsc run with the generated adapters");
  console.log("verify-pack: OK");
  rmSync(work, { recursive: true, force: true });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(`work directory kept for inspection: ${work}`);
  process.exitCode = 1;
}
