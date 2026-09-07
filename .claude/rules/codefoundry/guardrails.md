# Guardrails

Hard limits that apply in every CodeFoundry repository, whatever the task.

- **Never silence a check to make it pass.** No lint-disable directive, blanket ignore, `any` / `as unknown` cast, loosened type, or skipped test to clear a failure. Fix the cause, or stop and report the exact command and output.
- **Generated files are outputs, not sources.** `worker-configuration.d.ts` (`wrangler types`), `routeTree.gen.ts` (TanStack Router), anything under `dist/`, and `.claude/rules/codefoundry/` (owned by `codefoundry update`) are regenerated, never hand-edited.
- **No destructive git.** No history rewriting, `reset --hard`, force pushes, or branch deletion unless the request names that exact operation. Commit or push only when asked.
- **No secrets in tracked files.** Credentials belong in `.dev.vars*`, `.env*`, or the platform secret store, all gitignored. Never paste a token, key, or connection string into source, config, docs, or a commit message.
- **Stay inside the requested blast radius.** A task scoped to config, docs, or agent setup does not drift into application source, `wrangler.jsonc`, CI workflows, or migrations. Surface the need; do not act on it.
- **Do not paper over failures.** "No tests found" is not "tests passed"; a cache hit is not a fresh run; a skipped step is reported as skipped.
