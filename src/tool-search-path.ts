import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Raycast hands extensions a stripped `process.env` — no PATH, no HOME — so a spawned CLI gets
 * whatever we build here and nothing else. Resolving `orca` and `wt` by absolute path is not
 * enough: `wt` is a `/bin/sh` wrapper that execs `node` and then calls `arc`, `git` and `orca`
 * by name, using `readlink`/`dirname` from the system dirs on the way.
 */
const TOOL_DIRS = [
  "/opt/homebrew/bin",
  "/opt/homebrew/sbin",
  "/usr/local/bin",
  join(homedir(), ".local/bin"),
  join(homedir(), "bin"),
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

export function toolSearchPath(inherited: string | undefined = process.env.PATH): string {
  const dirs = [...TOOL_DIRS, ...(inherited ?? "").split(":")].filter((dir) => dir.length > 0);
  return [...new Set(dirs)].join(":");
}

/** Environment for a spawned CLI: whatever Raycast gave us, plus the parts it strips. */
export function toolEnv(): NodeJS.ProcessEnv {
  return { HOME: homedir(), ...process.env, PATH: toolSearchPath() };
}
