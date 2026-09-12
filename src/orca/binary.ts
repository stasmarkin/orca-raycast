import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getPreferenceValues } from "@raycast/api";

// Raycast spawns extensions with a minimal PATH, so a bare `orca` is not resolvable.
const CANDIDATES = [
  "/usr/local/bin/orca",
  "/opt/homebrew/bin/orca",
  join(homedir(), ".local/bin/orca"),
  join(homedir(), "bin/orca"),
];

// Keyed by the preference value: the menu bar command outlives a settings change.
let cached: { key: string; path: string } | undefined;

export class OrcaBinaryNotFound extends Error {
  constructor() {
    super("Orca CLI not found. Set its path in the extension preferences.");
    this.name = "OrcaBinaryNotFound";
  }
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveOrcaBinary(): string {
  const { orcaPath } = getPreferenceValues<{ orcaPath?: string }>();
  const configured = orcaPath?.trim() ?? "";
  if (cached?.key === configured) return cached.path;

  const resolved = configured ? (isExecutable(configured) ? configured : undefined) : CANDIDATES.find(isExecutable);

  if (!resolved) throw new OrcaBinaryNotFound();
  cached = { key: configured, path: resolved };
  return resolved;
}
