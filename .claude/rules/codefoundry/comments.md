# Comments

Do not add a comment that restates the code. A comment earns its place only when it records something a reader cannot recover from the code and would otherwise undo: a constraint, a rejected alternative, a non-obvious requirement of an external API. Write the **why**, never the **what**.

- **Default to no comment.** If a line needs explaining, rename something or restructure it first. A comment is the fallback, not the first move.
- **Never write a comment for an AI reader.** Path-scoped rules under `.claude/rules/` are the channel for that, and they cost context only when a matching file is touched. A comment costs context every time anyone reads the file, forever.
- **If the explanation runs past two lines, or applies to more than the line below it, it belongs in a rule**, not a comment block at the top of a file. Exception: config files whose comments are the documented source of truth (root `turbo.json` task descriptions, `wrangler.jsonc` annotations) - extend those in place.
- **Keep the comments that prevent a regression:** why a key is deliberately absent, why a non-default value is set, why an apparently redundant line is load-bearing. Deleting it should feel risky. If deleting it changes nothing, it should not be there.
- Applies to source, YAML and workflows, shell, and config alike.

## Do not generate

- Restating the next statement, control flow, or a well-named symbol.
- Section banners, IDE/scaffold boilerplate, and commented-out code (restore it or delete it).
- Stale TODOs that are no longer actionable.
- File-header essays that repeat a rule or `AGENTS.md`.

When you touch a file that still has these, delete them - do not hunt them in files you are not already editing, and do not rewrite working code just to make a comment deletable.

## Keep without re-litigating

- License headers and legally required notices.
- Generated-file banners (`wrangler types`, TanStack Router `routeTree.gen.ts`) - do not hand-edit those files.
- Machine-read markers: `@internal`, `oxlint-disable-*` with a reason, `// @vitest-environment …`, `@ts-expect-error` with a reason, workflow `# vX.Y.Z` SHA pins.
- JSDoc that is a public API contract or carries types tooling needs. Prose JSDoc that only repeats the name or signature is still a comment: delete it.
