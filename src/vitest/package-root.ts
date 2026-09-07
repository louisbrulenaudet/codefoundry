import { realpathSync } from "node:fs";

// realpath, not the raw configDir: the Vitest VS Code explorer caches the workspace folder via
// realpathSync, and a symlinked checkout (common on macOS) otherwise fails with
// "Attempted to get parent of root folder".
export function resolvePackageRoot(configDir: string): string {
  return realpathSync(configDir);
}
