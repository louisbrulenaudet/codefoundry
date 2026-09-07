import { defineConfig } from "oxfmt";
import { oxfmt } from "./src/oxfmt/index.ts";

export default defineConfig({
  ...oxfmt,
  ignorePatterns: [...(oxfmt.ignorePatterns ?? []), "fixtures/**"],
});
