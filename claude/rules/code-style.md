---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs}"
---

# Code Style

OXC is the source of truth: `oxlint.config.ts` (lint) and `oxfmt.config.ts` (format), both extending `@codefoundry/tooling-config`. Do not restyle to match personal habits - match the surrounding file and let `oxfmt` decide layout. Lint runs with `denyWarnings: true`, so any warning fails CI. Do not silence a rule, add a blanket ignore, or cast through `any` / `as unknown` to clear an error - fix the cause (see [guardrails.md](guardrails.md)).

- Lint and format are one whole-repo pass from the repository root (`pnpm lint`, `pnpm format:check`). Never `cd` into a package and run `oxlint .` - the context-aware Tailwind rules and type-aware linting need the root config.
- Inline suppressions use the `oxlint-*` form only (`// oxlint-disable-next-line <rule>` with a reason). `respectEslintDisableDirectives` is off, so `eslint-disable*` comments are ignored and, via `reportUnusedDisableDirectives: "error"`, any stray one fails CI.
- Keep route/tool handlers thin: validate at the boundary, delegate I/O to a client or service module, then map the response. Business logic does not belong inline in the handler.
- Prefer native type inference over hand-written shapes: derive types from the Zod schema or table definition that already defines them (`z.infer<typeof Schema>`), never a parallel `interface` or a `types.ts` file.
- Wire-safe constrained value sets are `as const` objects with a derived type, never `export enum` (`erasableSyntaxOnly` rejects it).
- Filenames are kebab-case; a React component file may be PascalCase to mirror its export, while hooks, utils and services stay kebab-case. Schema exports end in `Schema` (`…RequestSchema`, `…ResponseSchema`, `…MessageSchema`, `…EventSchema`); inferred types drop the suffix and never take a `Type` suffix.
