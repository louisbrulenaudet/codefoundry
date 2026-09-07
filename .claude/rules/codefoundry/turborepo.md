---
paths:
  - "**/turbo.json"
  - "**/turbo.jsonc"
---

# Turborepo

Root `turbo.json` holds the CodeFoundry policy (`global`, `futureFlags`) plus this repository's tasks; `codefoundry check` verifies the policy subset. Package `turbo.json` files extend `["//"]` and override only `tasks` (and `tags`). The rationale for a non-obvious task setting goes in its `description` field, which Turbo displays.

- **Repo-wide checks are `//#` root tasks.** OXC, syncpack and similar whole-repo passes run once at repo-root CWD (`//#lint`, `//#format:check`, `//#deps:check`), each mapped 1:1 to a root `package.json` script. Always address them with the `//#` prefix - a bare `turbo run lint` would fan out to any workspace that later adds a same-named script.
- **A root task stays `cache: false` unless its `inputs` are hand-authored and verified** with `turbo run <task> --dry-run=json`. A root task's `$TURBO_DEFAULT$` spans the whole repo, and explicit input globs do not honor `.gitignore`, so a bare `**/package.json` also matches nested `node_modules`. An under-specified hash yields a cached pass over code that was never checked.
- **Type-aware lint stays uncached**: it depends on the whole tsconfig graph plus the Tailwind entry point, and enumerating that correctly is not worth the staleness risk.
- `audit` is never a task (not a pure function of the commit; `envMode: "strict"` would strip its proxy vars) and `boundaries` is a CLI verb, not a task.
- Cross-package invalidation uses the `transit` no-op task (`dependsOn: ["^transit"]`) so `check-types` and `test` run in parallel while still re-running when a dependency's source changes.
- Remote cache is signed (`remoteCache.signature: true`, `longerSignatureKey`): `TURBO_REMOTE_CACHE_SIGNATURE_KEY` (>= 32 bytes) must match between CI and a dev machine, or remote fetches fail closed to local-only. Never lower `concurrency` in `turbo.json` for a small machine; pass `--concurrency` on the command line instead.
- Inspect the graph read-only with `turbo query affected [--tasks <task>]` and `turbo query ls [pkg]` before running tasks speculatively.
