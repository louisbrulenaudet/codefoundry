import { isRecord } from "../record.ts";

export interface TurboTask {
  description?: string;
  dependsOn?: string[];
  inputs?: string[];
  outputs?: string[];
  env?: string[];
  passThroughEnv?: string[];
  cache?: boolean;
  persistent?: boolean;
  interactive?: boolean;
  outputLogs?: "full" | "hash-only" | "new-only" | "errors-only" | "none";
}

export interface TurboGlobal {
  ui: "tui" | "stream";
  envMode: "strict" | "loose";
  cacheMaxAge: string;
  cacheMaxSize: string;
  remoteCache: { enabled: boolean; signature: boolean };
  inputs: string[];
  passThroughEnv: string[];
}

export interface TurboRootConfig {
  $schema: string;
  futureFlags: Record<string, boolean>;
  global: TurboGlobal;
  tasks: Record<string, TurboTask>;
}

export const turboFutureFlags: Record<string, boolean> = {
  affectedUsingTaskInputs: true,
  filterUsingTasks: true,
  watchUsingTaskInputs: true,
  strictTaskEntrypointSelection: true,
  // Remote-cache artifact signing key must be >= 32 bytes; a shorter key fails closed.
  longerSignatureKey: true,
  globalConfiguration: true,
};

export const turboGlobal: TurboGlobal = {
  ui: "tui",
  envMode: "strict",
  cacheMaxAge: "7d",
  cacheMaxSize: "10GB",
  remoteCache: { enabled: true, signature: true },
  // Prepended to every task's inputs. Lint/format configs must never be listed here: they
  // belong to the root lint tasks, and a global entry would re-invalidate every build on a
  // lint-rule-only edit.
  inputs: ["pnpm-workspace.yaml"],
  passThroughEnv: [
    "CI",
    "NODE_ENV",
    "NODE_COMPILE_CACHE",
    "NODE_DISABLE_COMPILE_CACHE",
  ],
};

const sourceInputs = [
  "$TURBO_DEFAULT$",
  "!README.md",
  "!AGENTS.md",
  "!CLAUDE.md",
];

const ciReporterEnv = [
  "AI_AGENT",
  "GITHUB_ACTIONS",
  "GITHUB_STEP_SUMMARY",
  "GITHUB_SERVER_URL",
  "GITHUB_REPOSITORY",
  "GITHUB_SHA",
  "GITHUB_WORKSPACE",
];

export const turboTasks: Record<string, TurboTask> = {
  transit: {
    description:
      "Internal no-op graph edge (transit-node pattern). Propagates source changes through declared workspace dependencies without serializing check-types tasks.",
    dependsOn: ["^transit"],
    inputs: sourceInputs,
  },
  "check-types": {
    description:
      "Type-check with tsc --noEmit. Uses the transit node (not ^check-types) so packages run in parallel while still invalidating when dependency source changes.",
    dependsOn: ["transit"],
    inputs: sourceInputs,
    outputs: ["node_modules/.tmp/*.tsbuildinfo"],
  },
  types: {
    description:
      "Regenerate a committed generated types file (e.g. wrangler types). Writes a tracked source file, so it is uncached; commit the result. CI verifies freshness with types:check instead.",
    cache: false,
    inputs: ["wrangler.jsonc"],
    outputs: [],
  },
  "types:check": {
    description:
      "Verify the committed generated types file still matches its source (e.g. wrangler types --check). Read-only and cached.",
    inputs: ["wrangler.jsonc", "worker-configuration.d.ts"],
    outputs: [],
  },
  build: {
    description:
      "Build production output to dist/; gated on the package's own check-types and upstream builds.",
    dependsOn: ["^build", "check-types"],
    inputs: sourceInputs,
    outputs: ["dist/**"],
    env: ["NODE_ENV"],
  },
  test: {
    description: "Run Vitest for the package (vitest run).",
    dependsOn: ["transit"],
    inputs: sourceInputs,
    outputs: [],
    passThroughEnv: ciReporterEnv,
  },
  "test:watch": {
    description:
      "Vitest watch mode (persistent, uncached). Humans only - agents must use the test task.",
    cache: false,
    persistent: true,
    passThroughEnv: ciReporterEnv,
  },
  dev: {
    description: "Run the local dev server (persistent, uncached).",
    cache: false,
    persistent: true,
  },
  preview: {
    description: "Serve the production build locally (persistent, uncached).",
    dependsOn: ["build"],
    cache: false,
    persistent: true,
  },
};

export function createTurboConfig(): TurboRootConfig {
  return {
    $schema: "./node_modules/turbo/schema.json",
    futureFlags: { ...turboFutureFlags },
    global: structuredClone(turboGlobal),
    tasks: structuredClone(turboTasks),
  };
}

function missingPolicy(
  expected: unknown,
  actual: unknown,
  path: string,
  issues: string[],
): void {
  if (Array.isArray(expected)) {
    const present = Array.isArray(actual) ? actual : [];
    for (const entry of expected) {
      if (!present.includes(entry)) {
        issues.push(`${path} must include ${JSON.stringify(entry)}`);
      }
    }
    return;
  }
  if (isRecord(expected)) {
    const record = isRecord(actual) ? actual : {};
    for (const [key, value] of Object.entries(expected)) {
      missingPolicy(value, record[key], `${path}.${key}`, issues);
    }
    return;
  }
  if (expected !== actual) {
    issues.push(
      `${path} must be ${JSON.stringify(expected)} (found ${JSON.stringify(actual)})`,
    );
  }
}

/**
 * Lists every point where a root turbo.json diverges from the CodeFoundry
 * policy. Only `futureFlags` and `global` are checked; arrays may carry extra
 * local entries and `tasks` are always repository-owned.
 */
export function turboPolicyIssues(rootConfig: unknown): string[] {
  const issues: string[] = [];
  const config = isRecord(rootConfig) ? rootConfig : {};
  missingPolicy(turboFutureFlags, config["futureFlags"], "futureFlags", issues);
  missingPolicy(turboGlobal, config["global"], "global", issues);
  return issues;
}
