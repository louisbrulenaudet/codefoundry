# Changelog

All notable changes to `@codefoundry/tooling-config` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows [Semantic Versioning](https://semver.org/): a new or stricter lint rule is a **minor** release, a removed or renamed export, preset or CLI flag is a **major** release, and a policy relaxation or documentation change is a **patch**.

## [0.1.0] - 2026-09-04

### Added

- Oxlint presets (`base`, `node`, `worker`, `react`, `reactComponents`, `tailwind`) for `oxlint.config.ts`.
- oxfmt policy object for `oxfmt.config.ts`.
- Syncpack policy (`workspace:*` for internal packages, `catalog:` for third-party dependencies, `package.json` field order).
- Turborepo policy (`global`, `futureFlags`, generic task conventions) with `createTurboConfig()` and `turboPolicyIssues()`.
- TypeScript presets: `strict`, `library`, `workers`, `vite-react`, `vite-node`, `tests`.
- Vitest factories: `defineNodeConfig`, `defineWorkersConfig`, `resolvePackageRoot`.
- Shared Claude Code rules, installed as a managed copy under `.claude/rules/codefoundry/`.
- `codefoundry` CLI with `init`, `doctor`, `check` and `update`.
