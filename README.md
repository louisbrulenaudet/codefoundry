# @codefoundry/tooling-config

Shared development-tooling policy for CodeFoundry repositories, distributed as one npm package: Oxlint, oxfmt, Syncpack, Turborepo, TypeScript and Vitest presets, the organisation's Claude Code rules, and a small `codefoundry` CLI that adopts and maintains them.

> Shared policy is centralized; repository topology remains local.

## Why this package exists

Every CodeFoundry repository used to carry its own copy of the same 300-line Oxlint config, the same compiler flags, the same dependency rules and the same agent rules. A rule change meant one pull request per repository, and the copies drifted. This package holds the **policy** once - lint rules, format options, dependency rules, compiler flags, Turbo defaults, Claude rules - while each repository keeps only what is genuinely its own: workspace globs, application paths, task outputs, `include` lists, generated files. A repository adopts the policy through a handful of two-line adapter files that import from this package, so `pnpm update @codefoundry/tooling-config` upgrades the whole organisation's tooling at once.

The implementation is deliberately boring: plain configuration objects, thin adapters, one small CLI. No configuration DSL, no plugin system, no framework.

## Installation

```bash
pnpm add -D @codefoundry/tooling-config
pnpm codefoundry init          # or, without installing first: pnpm dlx @codefoundry/tooling-config init
```

The package has three runtime dependencies (`@clack/prompts`, `semver`, `jsonc-parser`) and declares every tool it configures as an **optional peer dependency**. Install only the tools you adopt; `codefoundry doctor` reports the ones that are missing or outside the supported range.

## CLI

```text
codefoundry <command> [--yes] [--cwd <dir>]

  init      Adopt the CodeFoundry tooling in this repository
  doctor    Diagnose tool versions and configuration
  check     Validate the setup (deterministic, CI-friendly)
  update    Refresh the managed Claude Code rules
```

Exit codes: `0` ok, `1` problems found or cancelled, `2` usage error (unknown command, no `package.json` in the target directory). The CLI never touches the network, never runs shell strings, and only writes inside the repository root.

### `init`

`init` detects the repository instead of asking about it: package manager, `pnpm-workspace.yaml` packages, React, Tailwind CSS (and its entry stylesheet), Cloudflare Workers (`wrangler.*`), Vitest, Turborepo, TypeScript, and any existing Oxlint, oxfmt, Syncpack, Turbo or Claude configuration. It then proposes the applicable presets - interactively as a pre-selected multiselect, or all of them with `--yes` / when no TTY is attached - and writes thin adapters:

| Preset | File written | When offered |
|--------|--------------|--------------|
| Oxlint | `oxlint.config.ts` extending `base`, plus `worker` / `react` / `reactComponents` / `tailwind` overrides scoped to the detected app directories | always |
| oxfmt | `oxfmt.config.ts` spreading the shared object, plus the local Tailwind stylesheet | always |
| Syncpack | `syncpack.config.ts` re-exporting the shared policy | pnpm workspace |
| Turborepo | root `turbo.json` from `createTurboConfig()` | Turbo detected, or a workspace |
| TypeScript | one `tsconfig.json` per package that lacks one: the Workers preset, the split React layout (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`), or `library.json`; plus `tests/tsconfig.json` with the tests mixin where a `tests/` directory exists | always (existing files are never touched) |
| Claude Code rules | `.claude/rules/codefoundry/*.md` (managed copy) | always |

Generated files are already in the shape `oxfmt` produces, so a fresh `init` passes `oxfmt --check`. Safety rules: an adapter that already exists is left untouched and reported as `exists`; a legacy JSON config (`.oxlintrc.json`, `.oxfmtrc.json`, `.syncpackrc*`) is reported as a `conflict` with migration steps and is never edited or deleted; the only files `init` may overwrite are the managed rules under `.claude/rules/codefoundry/`, and only when they are stale. Running `init` twice is a no-op. Generated content is validated before it is written, and every path is checked to stay inside the repository.

`init` ends with the exact `pnpm add -D` command for the tools you still need and the one step it cannot do for you: wiring each `vitest.config.ts` to the shared factories.

### `doctor`

Runs the `check` suite plus environment diagnostics: Node.js against the package's `engines`, `pnpm` on the PATH, and each adopted tool (`typescript`, `oxlint`, `oxlint-tsgolint`, `oxfmt`, `syncpack`, `turbo`, `vitest`, `@cloudflare/vitest-plugin`, `oxlint-plugin-react-doctor`, `eslint-plugin-better-tailwindcss`) installed and within the supported range published as `peerDependencies`. A failing line shows the installed and required versions and the command that fixes it.

```text
✓  Node.js  24.19.0
✓  pnpm  11.25.0
✗  oxlint
     Installed: 1.62.0
     Required:  >=1.80.0 <2
     Run:
       pnpm update oxlint
```

### `check`

Deterministic validation for CI - pure filesystem reads, no prompts, no processes. Fails (exit `1`) when: an Oxlint or oxfmt adapter is missing or coexists with a legacy JSON config; a workspace has no Syncpack adapter; `turbo.json` does not parse or diverges from the shared `global` / `futureFlags` policy; a managed Claude rule is missing or edited. It warns when an adapter, `tsconfig.json` or `vitest.config.ts` exists without importing the shared package, and when `.claude/rules/codefoundry/` holds files this package does not ship.

```yaml
- run: pnpm codefoundry check
```

### `update`

Re-copies stale or missing managed Claude rules (this is the one intended overwrite) and lists tools outside their supported range. Adapters are yours after `init`; `update` never rewrites them.

## Presets

| Import | Exports | Consumed by |
|--------|---------|-------------|
| `@codefoundry/tooling-config/oxlint` | `base` (default), `node`, `worker`, `react`, `reactComponents`, `tailwind`, rule maps and overrides | `oxlint.config.ts` |
| `@codefoundry/tooling-config/oxfmt` | `oxfmt` | `oxfmt.config.ts` |
| `@codefoundry/tooling-config/syncpack` | `syncpack` | `syncpack.config.ts` |
| `@codefoundry/tooling-config/turbo` | `turboGlobal`, `turboFutureFlags`, `turboTasks`, `createTurboConfig()`, `turboPolicyIssues()` | `turbo.json` generation and checks |
| `@codefoundry/tooling-config/typescript/*.json` | `strict`, `library`, `workers`, `vite-react`, `vite-node`, `tests` | `tsconfig.json` `extends` |
| `@codefoundry/tooling-config/vitest` | `defineNodeConfig`, `resolvePackageRoot` | `vitest.config.ts` (Node) |
| `@codefoundry/tooling-config/vitest/workers` | `defineWorkersConfig`, `resolvePackageRoot` | `vitest.config.mts` (Workers pool) |
| `@codefoundry/tooling-config/claude` | `claudeRulesDir`, `listClaudeRules()` | tooling that mirrors the rules |
| `@codefoundry/tooling-config` | everything above except the Vitest factories, plus `supportedVersions` | scripts |

## Extending Oxlint

Oxlint reads `oxlint.config.ts` and merges `extends` entries with `defineConfig`. `base` carries the whole CodeFoundry policy: plugins, categories, type-aware linting, `denyWarnings`, the TypeScript / import / promise / unicorn rules, and overrides for config files, tests and evals. The runtime presets are override bodies you scope to your own paths:

```ts
import {
  base,
  react,
  reactComponents,
  tailwind,
  worker,
} from "@codefoundry/tooling-config/oxlint";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
  overrides: [
    { files: ["apps/worker-api/**/*.{ts,js,mjs}"], ...worker },
    { files: ["apps/front-app/src/**/*.{ts,tsx}"], ...react },
    { files: ["apps/front-app/src/**/*.tsx"], ...reactComponents },
    { files: ["apps/front-app/src/**/*.{ts,tsx}"], ...tailwind },
  ],
  settings: {
    "better-tailwindcss": { entryPoint: "apps/front-app/src/index.css" },
  },
});
```

A single Node package is `defineConfig({ extends: [base, node] })`. Things to know:

- Only `rules`, `plugins` and `overrides` merge across `extends`. `env`, `globals`, `settings`, `ignorePatterns` and `options` **replace**, so to add an ignore pattern respell the list: `ignorePatterns: [...(base.ignorePatterns ?? []), "fixtures/**"]`.
- `options.typeAware` is honoured in the root config only. Keep one root `oxlint.config.ts` and run `oxlint` from the repository root; nested `oxlint.config.ts` files are supported by Oxlint but are not the CodeFoundry default, because type-aware linting and the Tailwind context rules need the whole-repository view.
- Type-aware linting needs `oxlint-tsgolint` and TypeScript 7. `react` needs `oxlint-plugin-react-doctor`; `tailwind` needs `eslint-plugin-better-tailwindcss` and the `settings["better-tailwindcss"].entryPoint` stylesheet path.
- Add repository rules in the same file, after `extends`; they win over the shared ones.

## Extending TypeScript

Standard `extends`, nothing else:

| Preset | For | Notes |
|--------|-----|-------|
| `strict.json` | never extended directly | the shared strict flags |
| `library.json` | cross-runtime libraries | ES2023, no DOM, `noEmit`, incremental build info under `node_modules/.tmp` |
| `workers.json` | Cloudflare Workers | alias of `library.json`; add `types: ["./worker-configuration.d.ts"]` locally |
| `vite-react.json` | React + Vite SPAs | DOM lib, `jsx: react-jsx`, `types: ["vite/client"]` |
| `vite-node.json` | `vite.config.ts` projects | `types: ["node"]` |
| `tests.json` | `tests/tsconfig.json` mixin | last in an array `extends` |

```jsonc
// apps/worker-api/tsconfig.json
{
  "extends": "@codefoundry/tooling-config/typescript/workers.json",
  "compilerOptions": { "types": ["./worker-configuration.d.ts"] },
  "include": ["worker-configuration.d.ts", "src/**/*.ts"]
}

// packages/lib/tests/tsconfig.json
{ "extends": ["../tsconfig.json", "@codefoundry/tooling-config/typescript/tests.json"] }
```

React SPAs use the split layout (`tsconfig.json` → `tsconfig.app.json` on `vite-react.json`, `tsconfig.node.json` on `vite-node.json`). `codefoundry init` scaffolds these files for every workspace package that has no `tsconfig.json` yet, choosing the preset from what it detects (a `wrangler.*` file, a `react` dependency, or neither), and `codefoundry check` warns when a `tsconfig.json` stops extending the shared presets. `include`, `exclude`, `files`, `paths`, `rootDir`, `outDir`, `types` and project references always stay in the repository; the presets use `${configDir}` and never contain a path.

## Syncpack

```ts
// syncpack.config.ts
import { syncpack } from "@codefoundry/tooling-config/syncpack";

export default syncpack;
```

The policy: internal packages are linked with `workspace:*`; third-party `dependencies` and `devDependencies` must come from the pnpm catalog (`catalog:` or `catalog:<name>`), with `syncpack fix` able to move a literal version into the catalog; `syncpack format` owns `package.json` field order (which is why the oxfmt preset ignores `package.json`). Syncpack reads the workspace globs from `pnpm-workspace.yaml` itself, so no `source` is configured. Spread the object to add repository-specific groups: `export default { ...syncpack, versionGroups: [...syncpack.versionGroups, { ... }] }`.

`pnpm-workspace.yaml` remains entirely local. A typical CodeFoundry file declares the topology, `catalogMode: prefer`, the catalog itself, and the supply-chain settings (`minimumReleaseAge`, `trustPolicy`, `allowBuilds`, `strictDepBuilds`):

```yaml
packages:
  - apps/*
  - packages/*
catalogMode: prefer
catalog:
  oxlint: ^1.80.0
  typescript: ^7.0.2
  # ...
```

## Turborepo

Turbo has no way for a root `turbo.json` to extend another file or package - only package-level `turbo.json` files can `"extends": ["//"]`. So the shared policy is an object, not a file: `init` writes a root `turbo.json` from `createTurboConfig()` **only when none exists**, and `check` verifies that the existing file still contains the shared `futureFlags` and `global` settings (`envMode: "strict"`, signed remote cache, cache size limits, `pnpm-workspace.yaml` as a global input, CI pass-through variables). Arrays may carry extra local entries; `tasks` are always yours.

The generated tasks are the topology-free conventions - `transit`, `check-types`, `build`, `test`, `test:watch`, `dev`, `preview`, `types`, `types:check` - with their rationale in `description` fields. Repository-specific root tasks (`//#lint`, `//#deps:check`, deploy tasks) and `boundaries` tags are added locally. Package `turbo.json` files stay minimal:

```jsonc
{ "$schema": "../../node_modules/turbo/schema.json", "extends": ["//"], "tags": ["app"] }
```

## Vitest

Two entry points so a Node app never resolves `@cloudflare/vitest-plugin`:

```ts
// apps/front-app/vitest.config.ts
import { defineNodeConfig, resolvePackageRoot } from "@codefoundry/tooling-config/vitest";
const root = resolvePackageRoot(import.meta.dirname);
export default defineNodeConfig({ root, test: { dir: root } });

// apps/worker-api/vitest.config.mts
import path from "node:path";
import { defineWorkersConfig, resolvePackageRoot } from "@codefoundry/tooling-config/vitest/workers";
const root = resolvePackageRoot(import.meta.dirname);
export default defineWorkersConfig(
  { wrangler: { configPath: path.join(root, "wrangler.jsonc") } },
  { root, test: { dir: root } },
);
```

Both apply the shared mock hygiene (`restoreMocks`, `clearMocks`, `unstubEnvs`, `unstubGlobals`), the `tests/**` layout and `passWithNoTests: true`; the Node factory adds `pool: "threads"`, `isolate: false` and `fsModuleCache`. `reporters` is deliberately left unset so Vitest picks the agent and GitHub Actions reporters itself.

## Claude Code rules

Claude Code loads every `.md` under `.claude/rules/`, recursively, with optional `paths` frontmatter for path-scoped rules. There is no native way to reference rules from an npm package, so the package ships them and `init` installs a **managed copy** under `.claude/rules/codefoundry/`. `check` fails when a copy is missing or edited, `update` refreshes it after a package upgrade, and policy changes show up as reviewable diffs in the consuming repository.

Shipped rules: `guardrails` and `comments` (always loaded), `code-style`, `testing`, `typescript-config`, `turborepo`, `dependencies` and `markdown-style` (path-scoped). Repository-specific rules go in `.claude/rules/*.md` or any other subdirectory - never inside `codefoundry/`, which `check` reports as unexpected. `CLAUDE.md`, `.claude/settings.json`, agents and skills are not touched by this package.

## What stays repository-local

- `pnpm-workspace.yaml`: workspace globs, catalogs, `minimumReleaseAge`, `allowBuilds`, `trustPolicy`.
- The `files` globs in Oxlint overrides, the Tailwind `entryPoint` / `stylesheet`, and every `ignorePatterns` addition.
- `tsconfig.json` `include` / `exclude` / `types` / `paths` / `outDir`, and the split React layout.
- `turbo.json` tasks, root `//#` tasks, `boundaries` tags, deploy tasks.
- `vitest.config.ts` roots and wrangler paths.
- Local Claude rules outside `.claude/rules/codefoundry/`, `CLAUDE.md`, settings, hooks, agents, skills.
- Generated files: `worker-configuration.d.ts`, `routeTree.gen.ts`, build output.

## Supported versions

The ranges below are the package's `peerDependencies`; `codefoundry doctor` reads them at run time, so this table and the CLI never disagree.

| Tool | Supported |
|------|-----------|
| Node.js | `^22.18.0 \|\| >=24.0.0` (TypeScript config files need Node 22.18+) |
| pnpm | 10 or later (11 recommended) |
| TypeScript | `>=7.0.0 <8` |
| Oxlint | `>=1.80.0 <2` with `oxlint-tsgolint >=7.0.2001` |
| oxfmt | `>=0.65.0 <1` |
| Syncpack | `>=15.3.0 <16` |
| Turborepo | `>=2.10.0 <3` |
| Vitest | `^4.1.0 \|\| ^5.0.0`, `@cloudflare/vitest-plugin >=1.0.0 <2` |
| Oxlint JS plugins | `oxlint-plugin-react-doctor >=0.9.0 <1`, `eslint-plugin-better-tailwindcss >=4.7.0 <5` |

## Upgrading and migration

```bash
pnpm update @codefoundry/tooling-config
pnpm codefoundry update      # refresh the managed Claude rules
pnpm codefoundry doctor      # confirm tool versions against the new ranges
```

Semantic Versioning contract: a new or stricter lint rule, a new preset or a new CLI check is a **minor** release; removing or renaming an export, preset, generated file or CLI flag, or raising a peer range's floor, is a **major** release; relaxations and documentation are **patch** releases. Every change is listed in [CHANGELOG.md](CHANGELOG.md) with migration notes for majors. Because adapters only import the package, a minor upgrade needs no change in consuming repositories.

Migrating from hand-maintained configs: run `codefoundry init`; it reports each legacy `.oxlintrc.json` / `.oxfmtrc.json` / `.syncpackrc*` as a conflict. Move the repository-specific parts (path globs, Tailwind entry point, extra rules) into the new `*.config.ts` adapter on top of the shared object, delete the legacy file, then run `codefoundry check`.

## Troubleshooting

- **`oxlint` refuses to start with two config files.** JSON and TypeScript configs cannot coexist in one directory; delete the legacy `.oxlintrc.json` once its local parts live in `oxlint.config.ts`.
- **Type-aware rules report nothing or crash.** Install `oxlint-tsgolint`, make sure TypeScript 7 is installed, and run `oxlint` from the root so it finds the `tsconfig.json` graph. Nested configs must not set `options.typeAware`.
- **`check` says a Claude rule is stale.** A managed file was edited or the package was upgraded: run `codefoundry update`. Put local rules outside `.claude/rules/codefoundry/`.
- **`check` says `turbo.json` diverges.** Compare against `JSON.stringify(createTurboConfig(), null, 2)`; only `futureFlags` and `global` are checked and arrays may contain extra entries.
- **`doctor` reports `pnpm workspace: warn` on a fresh repository.** No lockfile exists yet; run `pnpm install`.
- **Adapters typecheck against the wrong types.** The tools' own `defineConfig` functions provide the types; keep `oxlint`, `oxfmt` and `syncpack` installed where the adapters live.

## Developing this package

```bash
pnpm install
pnpm run ci          # check-types, lint, format:check, test (builds lib/), test:pack
pnpm test:pack       # packs the tarball, installs it into a temp consumer, runs init/check/oxlint/oxfmt/tsc
```

The repository dogfoods its own presets from source (`oxlint.config.ts`, `oxfmt.config.ts`, `vitest.config.ts`, `tsconfig.json`), so a policy change is linted, formatted and type-checked against the package itself before it ships.
