import { z } from "zod";
import { invokeOrca } from "./invoke";
import { TerminalListSchema, TerminalTailSchema, type Terminal, type TerminalList, type TerminalTail } from "./types";

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

export async function switchToTerminal(handle: string): Promise<void> {
  await invokeOrca(["terminal", "switch", `--terminal=${handle}`], z.unknown());
}
