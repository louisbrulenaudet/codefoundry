---
paths:
  - "**/*.test.{ts,tsx}"
  - "**/*.spec.{ts,tsx}"
  - "**/tests/**"
  - "**/vitest.config.{ts,mts}"
  - "**/vitest.setup.ts"
---

# Testing

Vitest, configured per package through `@codefoundry/tooling-config/vitest` (Node) or `@codefoundry/tooling-config/vitest/workers` (Cloudflare Workers pool). Each package owns its `vitest.config.ts` and `test` / `test:watch` scripts; Turborepo runs and caches `test`. No root Vitest workspace or `projects`.

- Tests live under the package's `tests/` directory, mirroring the source layout, in kebab-case `*.test.ts` (`*.test.tsx` for component suites). Import from `"vitest"`; no globals, never `jest.*`.
- Pin `root` and `test.dir` with `resolvePackageRoot(import.meta.dirname)` so the Vitest VS Code explorer's realpath cache matches.
- Two runtimes: Worker-family apps use `defineWorkersConfig` and run inside workerd; SPAs and libraries use `defineNodeConfig`. Never put the Workers pool on a Node app or Node pool knobs (`pool`, `isolate: false`) on a Worker.
- Leave `reporters` unset: Vitest auto-selects the agent and GitHub Actions reporters only when nothing is configured.
- Run through package scripts or Turbo (`pnpm turbo run test --filter=<pkg>`, `pnpm --filter=<pkg> exec vitest run tests/<file>.test.ts`). Agents run `vitest run`, never watch mode or `--ui`. A Turbo cache hit replays the stored log; add `--force` for a fresh execution.
- Test at the trust boundaries the code actually enforces today (schemas, constrained value sets, fail-closed responses, status codes). Assert observable behavior - status, body, headers, binding effects - and reject `toBeDefined()`-only tests. Do not invent tests for surfaces that do not exist yet.
- Keep tests deterministic and independent of execution order. Mock only true I/O on Node; prefer real pool bindings on Workers.
- `any` is allowed only in test files (`typescript/no-explicit-any` is relaxed there); never reach for it in source to make a test pass.
- Never weaken source to make a test pass and never silence a failing test. Fix the cause, or stop and report the exact command and output. When you change a wire shape, update the tests that assert it in the same change.
