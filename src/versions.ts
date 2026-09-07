import { readFileSync } from "node:fs";
import { isRecord } from "./record.ts";

interface OwnPackage {
  name: string;
  version: string;
  engines: { node: string };
  peerDependencies: Record<string, string>;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function readOwnPackage(): OwnPackage {
  const url = new URL("../package.json", import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(url, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error(
      "package.json of @codefoundry/tooling-config is not an object",
    );
  }
  const engines = isRecord(parsed["engines"]) ? parsed["engines"] : {};
  return {
    name:
      typeof parsed["name"] === "string"
        ? parsed["name"]
        : "@codefoundry/tooling-config",
    version:
      typeof parsed["version"] === "string" ? parsed["version"] : "0.0.0",
    engines: {
      node: typeof engines["node"] === "string" ? engines["node"] : "*",
    },
    peerDependencies: stringRecord(parsed["peerDependencies"]),
  };
}

export const ownPackage: OwnPackage = readOwnPackage();

export const packageName = ownPackage.name;

/**
 * Tool name to supported semver range - the same ranges published as
 * peerDependencies.
 */
export const supportedVersions: Readonly<Record<string, string>> =
  ownPackage.peerDependencies;
