---
paths:
  - "**/package.json"
  - "pnpm-workspace.yaml"
---

# Dependencies

pnpm only. Third-party versions live once, in the `catalog:` section of `pnpm-workspace.yaml`; every workspace references them as `"catalog:"` (or `"catalog:<name>"` for a named transition catalog). Internal packages are linked with `"workspace:*"`. `syncpack lint` enforces both through `@codefoundry/tooling-config/syncpack`; `syncpack format` owns `package.json` field order, which is why `oxfmt` ignores `package.json`.

- Adding a dependency: `pnpm add <pkg> --filter <workspace>` writes `catalog:` when the package is already cataloged (`catalogMode: prefer`); otherwise add the entry to the catalog first, then reference it. Never write a literal version into a workspace `package.json`.
- Keep `pnpm-workspace.yaml` local: workspace globs, catalogs, `minimumReleaseAge`, `allowBuilds` / `strictDepBuilds`, and `trustPolicy` describe this repository's topology and supply-chain posture. `codefoundry init` never creates or edits it.
- Shared tooling is upgraded centrally: `pnpm update @codefoundry/tooling-config`, then `pnpm codefoundry update` to refresh the managed Claude rules; `pnpm codefoundry doctor` reports tools outside the supported range.
- Model dependency fields correctly: runtime imports in `dependencies`, build/test tooling in `devDependencies`, host-provided packages in `peerDependencies` (with `peerDependenciesMeta.optional` when adoption is partial). Remove unused entries rather than ignoring them.
- Do not hand-edit `pnpm-lock.yaml`. If an install script must run, allow that single package in `allowBuilds`; `strictDepBuilds: true` fails closed for everything else.
