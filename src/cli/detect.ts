import { globSync } from "node:fs";
import path from "node:path";
import { isRecord } from "../record.ts";
import {
  exists,
  firstExisting,
  isDirectory,
  readJson,
  readText,
  toPosix,
} from "./fs.ts";
import { managedRulesDir } from "./rules-sync.ts";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun" | "unknown";

export interface WorkspacePackage {
  /** POSIX path relative to the repository root; "." is the root package. */
  dir: string;
  name: string;
  react: boolean;
  tailwindStylesheet: string | undefined;
  vitest: boolean;
  worker: boolean;
  tsconfig: boolean;
}

export type AdapterTool = "oxlint" | "oxfmt" | "syncpack";

export interface AdapterFiles {
  /** The adapter `init` writes. */
  target: string;
  /** JS/TS config files, which can import the shared policy. */
  script: readonly string[];
  /** Data config files (JSON/YAML), which cannot. */
  legacy: readonly string[];
}

export const adapterFiles: Record<AdapterTool, AdapterFiles> = {
  oxlint: {
    target: "oxlint.config.ts",
    script: ["oxlint.config.ts", "oxlint.config.mts"],
    legacy: [".oxlintrc.json", ".oxlintrc.jsonc"],
  },
  oxfmt: {
    target: "oxfmt.config.ts",
    script: ["oxfmt.config.ts", "oxfmt.config.mts"],
    legacy: [".oxfmtrc.json", ".oxfmtrc.jsonc"],
  },
  syncpack: {
    target: "syncpack.config.ts",
    script: [
      "syncpack.config.ts",
      "syncpack.config.mts",
      "syncpack.config.js",
      "syncpack.config.mjs",
      "syncpack.config.cjs",
      ".syncpackrc.ts",
      ".syncpackrc.js",
      ".syncpackrc.mjs",
      ".syncpackrc.cjs",
    ],
    legacy: [
      ".syncpackrc",
      ".syncpackrc.json",
      ".syncpackrc.yaml",
      ".syncpackrc.yml",
    ],
  },
};

export interface ExistingConfig {
  script: string | undefined;
  legacy: string | undefined;
}

export function configFile(existing: ExistingConfig): string | undefined {
  return existing.script ?? existing.legacy;
}

export interface ExistingConfigs {
  oxlint: ExistingConfig;
  oxfmt: ExistingConfig;
  syncpack: ExistingConfig;
  turbo: string | undefined;
  managedRules: boolean;
}

export interface Detection {
  root: string;
  packageManager: PackageManager;
  workspace: boolean;
  workspacePatterns: string[];
  packages: WorkspacePackage[];
  react: boolean;
  tailwind: boolean;
  vitest: boolean;
  worker: boolean;
  typescript: boolean;
  turbo: boolean;
  existing: ExistingConfigs;
}

export const turboConfigFiles = ["turbo.json", "turbo.jsonc"];
export const vitestConfigFiles = ["vitest.config.ts", "vitest.config.mts"];
export const tsconfigNames = [
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "tests/tsconfig.json",
];
const wranglerConfigFiles = [
  "wrangler.jsonc",
  "wrangler.json",
  "wrangler.toml",
];
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

interface Manifest {
  name: string;
  dependencies: Set<string>;
  packageManager: string | undefined;
}

function readManifest(dir: string): Manifest | undefined {
  const parsed = readJson(path.join(dir, "package.json"));
  if (parsed === undefined) {
    return undefined;
  }
  const dependencies = new Set<string>();
  for (const field of dependencyFields) {
    const value = parsed[field];
    if (isRecord(value)) {
      for (const name of Object.keys(value)) {
        dependencies.add(name);
      }
    }
  }
  return {
    name:
      typeof parsed["name"] === "string" ? parsed["name"] : path.basename(dir),
    dependencies,
    packageManager:
      typeof parsed["packageManager"] === "string"
        ? parsed["packageManager"]
        : undefined,
  };
}

/** Reads the `packages:` list of pnpm-workspace.yaml without a YAML dependency. */
export function parseWorkspacePatterns(yaml: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "").trimEnd();
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) {
      continue;
    }
    const item = /^\s+-\s*(.+)$/.exec(line);
    if (item?.[1] === undefined) {
      inPackages = false;
      continue;
    }
    patterns.push(item[1].trim().replace(/^["']|["']$/g, ""));
  }
  return patterns;
}

function globDirectories(root: string, pattern: string): string[] {
  return globSync(pattern, {
    cwd: root,
    exclude: (entry: string) => path.basename(entry) === "node_modules",
  })
    .map(toPosix)
    .filter(
      (match) =>
        isDirectory(path.join(root, match)) &&
        exists(path.join(root, match, "package.json")),
    );
}

function expandWorkspacePatterns(root: string, patterns: string[]): string[] {
  const included = new Set<string>();
  for (const pattern of patterns.filter((entry) => !entry.startsWith("!"))) {
    for (const dir of globDirectories(root, pattern)) {
      included.add(dir);
    }
  }
  for (const pattern of patterns.filter((entry) => entry.startsWith("!"))) {
    for (const dir of globDirectories(root, pattern.slice(1))) {
      included.delete(dir);
    }
  }
  return [...included].toSorted();
}

function findTailwindStylesheet(root: string, dir: string): string | undefined {
  const packageDir = path.join(root, dir);
  // The entry stylesheet almost always sits directly in src/; the deep walk is the fallback.
  for (const pattern of ["src/*.css", "src/**/*.css"]) {
    const entry = globSync(pattern, { cwd: packageDir })
      .toSorted()
      .find((file) =>
        /@import\s+["']tailwindcss["']/.test(
          readText(path.join(packageDir, file)),
        ),
      );
    if (entry !== undefined) {
      return toPosix(path.join(dir, entry));
    }
  }
  return undefined;
}

function detectPackage(
  root: string,
  dir: string,
): WorkspacePackage | undefined {
  const packageDir = path.join(root, dir);
  const manifest = readManifest(packageDir);
  if (manifest === undefined) {
    return undefined;
  }
  const { dependencies } = manifest;
  return {
    dir,
    name: manifest.name,
    react: dependencies.has("react"),
    tailwindStylesheet: dependencies.has("tailwindcss")
      ? findTailwindStylesheet(root, dir)
      : undefined,
    vitest:
      dependencies.has("vitest") ||
      firstExisting(packageDir, vitestConfigFiles) !== undefined,
    worker: firstExisting(packageDir, wranglerConfigFiles) !== undefined,
    tsconfig: exists(path.join(packageDir, "tsconfig.json")),
  };
}

function detectPackageManager(
  root: string,
  manifest: Manifest | undefined,
): PackageManager {
  if (exists(path.join(root, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  const declared = manifest?.packageManager?.split("@")[0];
  if (
    declared === "pnpm" ||
    declared === "npm" ||
    declared === "yarn" ||
    declared === "bun"
  ) {
    return declared;
  }
  if (exists(path.join(root, "yarn.lock"))) {
    return "yarn";
  }
  if (exists(path.join(root, "package-lock.json"))) {
    return "npm";
  }
  if (
    exists(path.join(root, "bun.lock")) ||
    exists(path.join(root, "bun.lockb"))
  ) {
    return "bun";
  }
  return "unknown";
}

function existingConfig(root: string, files: AdapterFiles): ExistingConfig {
  return {
    script: firstExisting(root, files.script),
    legacy: firstExisting(root, files.legacy),
  };
}

export function detectRepository(root: string): Detection {
  const workspaceFile = path.join(root, "pnpm-workspace.yaml");
  // pnpm also writes pnpm-workspace.yaml for settings alone (allowBuilds, catalogs), so only a
  // `packages:` list makes this a workspace.
  const workspacePatterns = exists(workspaceFile)
    ? parseWorkspacePatterns(readText(workspaceFile))
    : [];
  const workspace = workspacePatterns.length > 0;
  const rootManifest = readManifest(root);
  const rootDependencies = rootManifest?.dependencies ?? new Set<string>();
  const packages = [".", ...expandWorkspacePatterns(root, workspacePatterns)]
    .map((dir) => detectPackage(root, dir))
    .filter((entry): entry is WorkspacePackage => entry !== undefined);
  const turboConfig = firstExisting(root, turboConfigFiles);

  return {
    root,
    packageManager: detectPackageManager(root, rootManifest),
    workspace,
    workspacePatterns,
    packages,
    react: packages.some((entry) => entry.react),
    tailwind: packages.some((entry) => entry.tailwindStylesheet !== undefined),
    vitest: packages.some((entry) => entry.vitest),
    worker: packages.some((entry) => entry.worker),
    typescript:
      packages.some((entry) => entry.tsconfig) ||
      rootDependencies.has("typescript"),
    turbo: turboConfig !== undefined || rootDependencies.has("turbo"),
    existing: {
      oxlint: existingConfig(root, adapterFiles.oxlint),
      oxfmt: existingConfig(root, adapterFiles.oxfmt),
      syncpack: existingConfig(root, adapterFiles.syncpack),
      turbo: turboConfig,
      managedRules: isDirectory(path.join(root, managedRulesDir)),
    },
  };
}
