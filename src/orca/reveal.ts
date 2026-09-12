import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { switchToTerminal } from "./terminals";

const run = promisify(execFile);

const ORCA_BUNDLE_ID = "com.stablyai.orca";

/** `terminal switch` moves the tab to the foreground inside Orca; the app itself still has to be raised. */
export async function revealTerminalInOrca(handle: string): Promise<void> {
  await switchToTerminal(handle);
  await run("/usr/bin/open", ["-b", ORCA_BUNDLE_ID]);
}

export async function activateOrca(): Promise<void> {
  await run("/usr/bin/open", ["-b", ORCA_BUNDLE_ID]);
}
