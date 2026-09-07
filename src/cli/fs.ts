import type { ParseError } from "jsonc-parser";
import { parse, printParseErrorCode } from "jsonc-parser";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { isRecord } from "../record.ts";

export function exists(filePath: string): boolean {
  return existsSync(filePath);
}

export function isDirectory(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

export function readText(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function firstExisting(
  dir: string,
  candidates: readonly string[],
): string | undefined {
  return candidates.find((candidate) => exists(path.join(dir, candidate)));
}

/**
 * A JSON object file, or undefined when the file is missing, invalid or not an
 * object.
 */
export function readJson(
  filePath: string,
): Record<string, unknown> | undefined {
  if (!exists(filePath)) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(readText(filePath));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export interface JsoncResult {
  value: unknown;
  errors: string[];
}

export function readJsonc(filePath: string): JsoncResult {
  const parseErrors: ParseError[] = [];
  const value: unknown = parse(readText(filePath), parseErrors, {
    allowTrailingComma: true,
  });
  const errors = parseErrors.map(
    (error) =>
      `${printParseErrorCode(error.error)} at offset ${String(error.offset)}`,
  );
  return { value, errors };
}

/** Writes a repository-relative file, refusing any path that escapes the root. */
export function writeText(
  root: string,
  relativePath: string,
  content: string,
): void {
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Refusing to write outside the repository root: ${relativePath}`,
    );
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}
