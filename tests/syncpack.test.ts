import { describe, expect, it } from "vitest";
import { syncpack } from "../src/syncpack/index.ts";

describe("syncpack preset", () => {
  it("pins internal packages to workspace:* and routes third-party deps through the catalog", () => {
    const groups = syncpack.versionGroups ?? [];
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      dependencies: ["$LOCAL"],
      pinVersion: "workspace:*",
    });
    expect(groups[1]).toMatchObject({
      policy: "catalog",
      dependencyTypes: ["prod", "dev"],
      dependencies: ["**"],
    });
  });

  it("owns package.json formatting but not the workspace topology", () => {
    expect(syncpack.sortFirst?.[0]).toBe("name");
    expect(syncpack.sortAz).toContain("dependencies");
    expect(syncpack.sortPackages).toBe(true);
    expect(syncpack).not.toHaveProperty("source");
    expect(JSON.stringify(syncpack)).not.toContain("apps/");
  });
});
