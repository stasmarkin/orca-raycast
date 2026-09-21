import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getPreferenceValues } from "@raycast/api";

// Raycast spawns extensions with a minimal PATH, so a bare `wt` is not resolvable.
const CANDIDATES = [
  "/usr/local/bin/wt",
  "/opt/homebrew/bin/wt",
  join(homedir(), ".local/bin/wt"),
  join(homedir(), "bin/wt"),
];

// Keyed by the preference value: a command outlives a settings change.
let cached: { key: string; path: string } | undefined;

export class WtBinaryNotFound extends Error {
  constructor() {
    super("wt CLI not found. Set its path in the extension preferences.");
    this.name = "WtBinaryNotFound";
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

export function resolveWtBinary(): string {
  const { wtPath } = getPreferenceValues<{ wtPath?: string }>();
  const configured = wtPath?.trim() ?? "";
  if (cached?.key === configured) return cached.path;

  const resolved = configured ? (isExecutable(configured) ? configured : undefined) : CANDIDATES.find(isExecutable);

  if (!resolved) throw new WtBinaryNotFound();
  cached = { key: configured, path: resolved };
  return resolved;
}
