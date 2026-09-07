import path from "node:path";
import type { Detection, WorkspacePackage } from "./detect.ts";
import { isRecord } from "../record.ts";
import { createTurboConfig } from "../turbo/index.ts";
import { packageName } from "../versions.ts";
import { exists, isDirectory } from "./fs.ts";

const printWidth = 80;

function quoted(packages: WorkspacePackage[], suffix: string): string[] {
  return packages.map((entry) =>
    JSON.stringify(entry.dir === "." ? suffix : `${entry.dir}/${suffix}`),
  );
}

// The generators below emit the shape oxfmt produces, so a fresh `init` already passes
// `oxfmt --check`; tests run the real formatter over their output.
function importLine(names: string[], from: string): string[] {
  const single = `import { ${names.join(", ")} } from "${from}";`;
  if (single.length <= printWidth) {
    return [single];
  }
  return [
    "import {",
    ...names.map((name) => `  ${name},`),
    `} from "${from}";`,
  ];
}

function overrideLines(globs: string[], presetName: string): string[] {
  const single = `    { files: [${globs.join(", ")}], ...${presetName} },`;
  if (single.length <= printWidth) {
    return [single];
  }
  return [
    "    {",
    "      files: [",
    ...globs.map((glob) => `        ${glob},`),
    "      ],",
    `      ...${presetName},`,
    "    },",
  ];
}

export function oxlintAdapter(detection: Detection): string {
  const workers = detection.packages.filter((entry) => entry.worker);
  const reacts = detection.packages.filter((entry) => entry.react);
  const tailwind = reacts.filter(
    (entry) => entry.tailwindStylesheet !== undefined,
  );
  const nodeOnly = workers.length === 0 && reacts.length === 0;
  const names = ["base"];
  const overrides: string[] = [];

  if (workers.length > 0) {
    names.push("worker");
    overrides.push(
      ...overrideLines(quoted(workers, "**/*.{ts,js,mjs}"), "worker"),
    );
  }
  if (reacts.length > 0) {
    names.push("react", "reactComponents");
    overrides.push(
      ...overrideLines(quoted(reacts, "src/**/*.{ts,tsx}"), "react"),
      ...overrideLines(quoted(reacts, "src/**/*.tsx"), "reactComponents"),
    );
  }
  if (tailwind.length > 0) {
    names.push("tailwind");
    overrides.push(
      ...overrideLines(quoted(tailwind, "src/**/*.{ts,tsx}"), "tailwind"),
    );
  }
  if (nodeOnly) {
    names.push("node");
  }

  const lines = [
    ...importLine(names.toSorted(), `${packageName}/oxlint`),
    'import { defineConfig } from "oxlint";',
    "",
    "export default defineConfig({",
    nodeOnly ? "  extends: [base, node]," : "  extends: [base],",
  ];
  if (overrides.length > 0) {
    lines.push("  overrides: [", ...overrides, "  ],");
  }
  const entryPoint = tailwind[0]?.tailwindStylesheet;
  if (entryPoint !== undefined) {
    lines.push(
      "  settings: {",
      `    "better-tailwindcss": { entryPoint: ${JSON.stringify(entryPoint)} },`,
      "  },",
    );
  }
  lines.push("});", "");
  return lines.join("\n");
}

export function oxfmtAdapter(detection: Detection): string {
  const stylesheet = detection.packages.find(
    (entry) => entry.tailwindStylesheet !== undefined,
  )?.tailwindStylesheet;
  const header = [
    `import { oxfmt } from "${packageName}/oxfmt";`,
    'import { defineConfig } from "oxfmt";',
    "",
  ];
  if (stylesheet === undefined) {
    return [...header, "export default defineConfig(oxfmt);", ""].join("\n");
  }
  return [
    ...header,
    "export default defineConfig({",
    "  ...oxfmt,",
    `  sortTailwindcss: { stylesheet: ${JSON.stringify(stylesheet)} },`,
    "});",
    "",
  ].join("\n");
}

export function syncpackAdapter(): string {
  return `import { syncpack } from "${packageName}/syncpack";\n\nexport default syncpack;\n`;
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

// Two-space JSON, except that an array of scalars stays on one line when the whole line
// (including its key and trailing comma) fits in 80 columns - what oxfmt produces.
function json(value: unknown, indent = "", lineStart = indent.length): string {
  if (Array.isArray(value)) {
    const inline = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
    if (value.every(isScalar) && lineStart + inline.length + 1 <= printWidth) {
      return inline;
    }
    const inner = `${indent}  `;
    return `[\n${value.map((item) => `${inner}${json(item, inner)}`).join(",\n")}\n${indent}]`;
  }
  if (isRecord(value)) {
    const inner = `${indent}  `;
    const lines = Object.entries(value).map(([key, item]) => {
      const head = `${inner}${JSON.stringify(key)}: `;
      return `${head}${json(item, inner, head.length)}`;
    });
    return lines.length === 0 ? "{}" : `{\n${lines.join(",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}

function jsonFile(value: unknown): string {
  return `${json(value)}\n`;
}

export function turboAdapter(): string {
  return jsonFile(createTurboConfig());
}

export interface GeneratedFile {
  path: string;
  content: string;
}

const tsconfigSchema = "https://json.schemastore.org/tsconfig";

function preset(name: string): string {
  return `${packageName}/typescript/${name}.json`;
}

/**
 * Tsconfig files for one package: the split React layout, the Workers preset
 * (with the generated types only once wrangler has produced them), or the
 * library preset, plus the tests mixin when a tests/ directory exists. The
 * first entry is always `<dir>/tsconfig.json`.
 */
export function tsconfigFiles(
  root: string,
  entry: WorkspacePackage,
): GeneratedFile[] {
  const prefix = entry.dir === "." ? "" : `${entry.dir}/`;
  const packageDir = path.join(root, entry.dir);
  const files: GeneratedFile[] = [];
  if (entry.react) {
    files.push(
      {
        path: `${prefix}tsconfig.json`,
        content: jsonFile({
          $schema: tsconfigSchema,
          extends: "./tsconfig.app.json",
        }),
      },
      {
        path: `${prefix}tsconfig.app.json`,
        content: jsonFile({
          $schema: tsconfigSchema,
          extends: preset("vite-react"),
          include: ["src/**/*.ts", "src/**/*.tsx"],
        }),
      },
      {
        path: `${prefix}tsconfig.node.json`,
        content: jsonFile({
          $schema: tsconfigSchema,
          extends: preset("vite-node"),
          include: ["vite.config.ts"],
        }),
      },
    );
  } else if (entry.worker) {
    const generatedTypes = exists(
      path.join(packageDir, "worker-configuration.d.ts"),
    );
    files.push({
      path: `${prefix}tsconfig.json`,
      content: jsonFile({
        $schema: tsconfigSchema,
        extends: preset("workers"),
        ...(generatedTypes
          ? { compilerOptions: { types: ["./worker-configuration.d.ts"] } }
          : {}),
        include: generatedTypes
          ? ["worker-configuration.d.ts", "src/**/*.ts"]
          : ["src/**/*.ts"],
      }),
    });
  } else {
    files.push({
      path: `${prefix}tsconfig.json`,
      content: jsonFile({
        $schema: tsconfigSchema,
        extends: preset("library"),
        include: ["src/**/*.ts"],
      }),
    });
  }
  if (isDirectory(path.join(packageDir, "tests"))) {
    files.push({
      path: `${prefix}tests/tsconfig.json`,
      content: jsonFile({
        $schema: tsconfigSchema,
        extends: ["../tsconfig.json", preset("tests")],
      }),
    });
  }
  return files;
}

/** True when a config file imports the given subpath of this package. */
export function referencesPackage(content: string, subpath: string): boolean {
  return content.includes(`${packageName}/${subpath}`);
}
