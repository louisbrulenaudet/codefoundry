import type { ViteUserConfig } from "vitest/config";
import type { InlineConfig } from "vitest/node";
import { defineConfig, mergeConfig } from "vitest/config";

export { resolvePackageRoot } from "./package-root.ts";

// Duplicated in workers.ts on purpose: the two entries must not import each other, so a Node
// app never resolves @cloudflare/vitest-plugin. No `reporters` here - Vitest auto-selects the
// agent / GitHub Actions reporters only when the option is left unset.
const sharedTestDefaults: InlineConfig = {
  include: ["tests/**/*.test.{ts,tsx}"],
  restoreMocks: true,
  clearMocks: true,
  unstubEnvs: true,
  unstubGlobals: true,
  passWithNoTests: true,
  fsModuleCache: true,
};

export function defineNodeConfig(
  overrides: ViteUserConfig = {},
): ViteUserConfig {
  return mergeConfig(
    defineConfig({
      test: {
        ...sharedTestDefaults,
        environment: "node",
        pool: "threads",
        isolate: false,
      },
    }),
    defineConfig(overrides),
  );
}
