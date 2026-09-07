---
paths:
  - "**/tsconfig*.json"
---

# TypeScript Config Presets

Shared presets ship in `@codefoundry/tooling-config/typescript/*.json`. Packages **extend** a runtime preset and override only `compilerOptions.types` and `include` - never fork compiler options. The preset JSON is the source of truth for *which* options are set; this rule covers what the JSON cannot tell you.

| Preset | For | Runtime shape |
|--------|-----|---------------|
| `strict.json` | never extended directly | shared strict core |
| `library.json` | cross-runtime libraries | `lib: es2023`, no DOM or Worker globals; `noEmit` + incremental `tsBuildInfoFile` |
| `workers.json` | Cloudflare Worker apps | thin role alias of `library.json` |
| `vite-react.json` | React + Vite SPAs | `lib` includes `DOM`, `jsx: react-jsx`, `types: ["vite/client"]` |
| `vite-node.json` | Vite build-time config only | `types: ["node"]`, no DOM |
| `tests.json` | **mixin**, last in an array `extends` after the package base | no `lib`/`target`; tests tsbuildinfo path, `tests/` + `src/` include |

## Flags that change how you write code

`strict.json` is more than `strict: true`; write to these from the start:

| Flag | What it forces |
|------|----------------|
| `exactOptionalPropertyTypes` | An optional prop may be **absent**, not explicitly `undefined` |
| `noUncheckedIndexedAccess` | Array and index-signature access yields `T \| undefined` - narrow before use |
| `noPropertyAccessFromIndexSignature` | Index-signature keys need bracket notation |
| `verbatimModuleSyntax` | Type-only imports must say `import type` |
| `erasableSyntaxOnly` | No `enum`, namespaces, or parameter properties - shared value sets are `as const` objects |
| `noImplicitOverride` | Subclass overrides must be marked `override` |

## Deliberate omissions

- **No preset-level `types` for Workers.** Each Worker sets `compilerOptions.types` to `["./worker-configuration.d.ts"]` (plus `"node"` with `nodejs_compat`). Runtime types come from `wrangler types`, committed, never from the preset.
- **`isolatedDeclarations` is off.** Schema-first DTOs (`z.infer<typeof Schema>`) would otherwise need a hand-written duplicate type on every export.

## Rules

1. Extend, don't fork: `"extends": "@codefoundry/tooling-config/typescript/<preset>.json"`, then only `types` and `include`.
2. Keep presets path-agnostic: `${configDir}` only; never `paths`, `imports`, or a repository path in a shared preset. For in-app absolute imports use the package's `package.json` `"imports"` (`#/*`), not `compilerOptions.paths`.
3. Typecheck is `tsc --noEmit` per package, orchestrated by Turborepo's transit node. No Project References, `composite`, or root solution `tsconfig.json`.
4. React SPAs use the split layout: `tsconfig.json` extends `tsconfig.app.json` (`vite-react.json`, browser `src/**`) plus `tsconfig.node.json` (`vite-node.json`, `vite.config.ts`).
5. Test suites are a separate project at `tests/tsconfig.json` (keep that exact name so editors find it): `"extends": ["../tsconfig.json", "@codefoundry/tooling-config/typescript/tests.json"]`. `include` arrays replace rather than merge, so a package adding roots respells the full list with `${configDir}`.
6. Every package running `check-types` lists `typescript` in its own devDependencies. Verify preset changes repo-wide with `pnpm check-types` from the root.
