import { invokeOrca } from "./invoke";
import type { Terminal, TerminalListResult, TerminalTail } from "./types";

export async function listTerminals(): Promise<Terminal[]> {
  const result = await invokeOrca<TerminalListResult>(["terminal", "list"]);
  return result.terminals;
}

/** Terminals are matched by workspace path because folder workspaces have no resolvable id selector. */
export function terminalsForWorkspace(terminals: Terminal[], workspacePath: string): Terminal[] {
  return terminals.filter((terminal) => terminal.worktreePath === workspacePath);
}

export function preferredAgentTerminal(terminals: Terminal[]): Terminal | undefined {
  return terminals.find((terminal) => terminal.agentIdentity && terminal.connected) ?? terminals[0];
}

export async function readTerminal(handle: string, lines: number): Promise<TerminalTail> {
  const result = await invokeOrca<{ terminal: TerminalTail }>([
    "terminal",
    "read",
    "--terminal",
    handle,
    "--limit",
    String(lines),
  ]);
  return result.terminal;
}

export async function sendToTerminal(handle: string, text: string, submit: boolean): Promise<void> {
  const args = ["terminal", "send", "--terminal", handle, "--text", text];
  if (submit) args.push("--enter");
  await invokeOrca(args);
}

export async function interruptTerminal(handle: string): Promise<void> {
  await invokeOrca(["terminal", "send", "--terminal", handle, "--interrupt"]);
}

export async function switchToTerminal(handle: string): Promise<void> {
  await invokeOrca(["terminal", "switch", "--terminal", handle]);
}
