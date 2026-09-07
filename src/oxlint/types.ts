import type { OxlintConfig, OxlintOverride } from "oxlint";

export type { OxlintConfig, OxlintOverride };
export type OxlintRules = NonNullable<OxlintConfig["rules"]>;
export type OxlintPreset = Omit<OxlintOverride, "files" | "excludeFiles">;
