import {
  defineWorkersConfig,
  resolvePackageRoot,
} from "@codefoundry/tooling-config/vitest/workers";
import path from "node:path";

const root = resolvePackageRoot(import.meta.dirname);

export default defineWorkersConfig(
  { wrangler: { configPath: path.join(root, "wrangler.jsonc") } },
  { root, test: { dir: root } },
);
