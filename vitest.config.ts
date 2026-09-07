import { defineNodeConfig, resolvePackageRoot } from "./src/vitest/index.ts";

const root = resolvePackageRoot(import.meta.dirname);

export default defineNodeConfig({
  root,
  test: { dir: root, passWithNoTests: false },
});
