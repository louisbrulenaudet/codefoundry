import {
  defineNodeConfig,
  resolvePackageRoot,
} from "@codefoundry/tooling-config/vitest";

const root = resolvePackageRoot(import.meta.dirname);

export default defineNodeConfig({ root, test: { dir: root } });
