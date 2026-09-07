import { defineConfig } from "oxlint";
import { base, node } from "./src/oxlint/index.ts";

export default defineConfig({
  extends: [base, node],
  // ignorePatterns replace rather than merge across `extends`, so the shared list is respelled.
  ignorePatterns: [...(base.ignorePatterns ?? []), "fixtures/**"],
});
