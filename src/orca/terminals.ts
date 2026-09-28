import { z } from "zod";
import { invokeOrca, OrcaContractError } from "./invoke";
import {
  CreateTerminalSchema,
  TerminalListSchema,
  TerminalTailSchema,
  TerminalWaitSchema,
  type Terminal,
  type TerminalList,
  type TerminalTail,
} from "./types";

const LIST_LIMIT = 2000;

export async function listTerminals(): Promise<TerminalList> {
  return invokeOrca(["terminal", "list", `--limit=${LIST_LIMIT}`], TerminalListSchema);
}

/** Terminals are matched by workspace path because folder workspaces have no resolvable id selector. */
export function terminalsForWorkspace(terminals: Terminal[], workspacePath: string): Terminal[] {
  // An empty path would match every terminal whose own path failed to parse.
  if (!workspacePath) return [];
  return terminals.filter((terminal) => terminal.worktreePath === workspacePath);
}

/**
 * Whether text can be typed into this pane. Sending with Enter to a plain shell would execute the
 * user's message as a shell command, so every send path has to gate on this one predicate.
 */
export function canReceiveInput(terminal: Terminal): boolean {
  return Boolean(terminal.agentIdentity) && terminal.connected && terminal.writable;
}

/** A terminal safe to type into. Deliberately has no fallback to "first pane". */
export function agentTerminal(terminals: Terminal[]): Terminal | undefined {
  return terminals.find(canReceiveInput);
}

/** Any terminal is fine for navigation, where picking the wrong pane is harmless. */
export function anyTerminal(terminals: Terminal[]): Terminal | undefined {
  return agentTerminal(terminals) ?? terminals[0];
}

export async function readTerminal(handle: string, lines: number): Promise<TerminalTail> {
  const result = await invokeOrca(["terminal", "read", `--terminal=${handle}`, `--limit=${lines}`], TerminalTailSchema);
  return result.terminal;
}

export async function sendToTerminal(handle: string, text: string, submit: boolean): Promise<void> {
  const args = ["terminal", "send", `--terminal=${handle}`, `--text=${text}`];
  if (submit) args.push("--enter");
  await invokeOrca(args, z.unknown());
}

/** Creates a terminal running `command`; used to launch an agent Orca's own `--agent` flag cannot configure. */
export async function createTerminal(workspaceSelector: string, command: string, title?: string): Promise<string> {
  const args = ["terminal", "create", `--worktree=${workspaceSelector}`, `--command=${command}`];
  if (title) args.push(`--title=${title}`);
  const result = await invokeOrca(args, CreateTerminalSchema, { timeoutMs: 60_000 });
  const handle = result.terminal?.handle ?? result.handle;
  if (handle === undefined) throw new OrcaContractError("terminal create", "no handle in the response");
  return handle;
}

/**
 * Waits for the agent TUI to finish booting. False means it never got there: Orca answers a timeout
 * with `ok:true` and `satisfied:false`, so the caller must not type into that pane.
 */
export async function waitForTuiIdle(handle: string, timeoutMs: number): Promise<boolean> {
  const result = await invokeOrca(
    ["terminal", "wait", `--terminal=${handle}`, "--for=tui-idle", `--timeout-ms=${timeoutMs}`],
    TerminalWaitSchema,
    { timeoutMs: timeoutMs + 15_000 },
  );
  return result.satisfied ?? result.wait?.satisfied ?? false;
}

/** The send-path guard for a caller that only has a handle: the pane may still be a plain shell. */
export async function terminalAcceptsInput(handle: string): Promise<boolean> {
  const { terminals } = await listTerminals();
  const terminal = terminals.find((entry) => entry.handle === handle);
  return terminal !== undefined && canReceiveInput(terminal);
}

export async function switchToTerminal(handle: string): Promise<void> {
  await invokeOrca(["terminal", "switch", `--terminal=${handle}`], z.unknown());
}
