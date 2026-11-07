import { canReceiveInput, listTerminals, paneKeyOf, sendToTerminal, terminalsForWorkspace } from "../orca/terminals";
import { listWorkspaces } from "../orca/workspaces";
import { OrcaTimeoutError } from "../orca/invoke";
import { isVisible, type Terminal, type Workspace } from "../orca/types";
import { TemplateInputRequired } from "./launch-template";
import { expandPlaceholders } from "./placeholders";
import { templatePrompt } from "./template-preview";
import type { WorkspaceTemplate } from "./template-file";

/** The target cannot take the message right now; the text says what the user should do about it. */
export class SendTargetError extends Error {}

/** The send may have landed after all; resending blindly would give the agent the task twice. */
export class SendUnconfirmedError extends Error {
  constructor(target: string) {
    super(`Orca did not confirm the message to "${target}" in time — check the agent before sending again`);
    this.name = "SendUnconfirmedError";
  }
}

export type SendOutcome = {
  /** The pane the message went to, for Focus to reveal. */
  handle: string;
};

/** Types the template's message into the agent of an open workspace, as if the user had. */
export async function sendTemplate(template: WorkspaceTemplate, input: string): Promise<SendOutcome> {
  if (template.send === undefined) throw new Error(`Template "${template.id}" names no workspace to send to`);
  const trimmed = input.trim();
  if (template.requiresInput && !trimmed) throw new TemplateInputRequired(template.title);

  const message = await expandPlaceholders(templatePrompt(template) ?? "", { input: trimmed });
  if (!message.trim()) throw new SendTargetError("Nothing to send");

  const [workspaces, terminalList] = await Promise.all([listWorkspaces(), listTerminals()]);
  // A namesake workspace or a second agent past the cut would let an ambiguous target look unique.
  if (workspaces.truncated || terminalList.truncated) {
    throw new SendTargetError("Orca truncated its workspace or terminal list — send with Send to Agent");
  }
  const handle = pickSendTarget(workspaces.worktrees, terminalList.terminals, template.send);
  try {
    // A newline inside the TUI submits, so the whole message has to arrive as one line.
    await sendToTerminal(handle, message.replace(/\s*\n\s*/g, " "), true);
  } catch (error) {
    if (error instanceof OrcaTimeoutError) throw new SendUnconfirmedError(template.send);
    throw error;
  }
  return { handle };
}

/**
 * The pane of the one agent Orca tracks in the workspace with this exact name. Orca's agent list picks
 * the pane — a stray pane can claim an agent Orca does not track — and the pane must still identify as
 * an agent, because a listed agent may have exited and left a shell that would run the message.
 */
export function pickSendTarget(workspaces: Workspace[], terminals: Terminal[], name: string): string {
  const matches = workspaces.filter((workspace) => isVisible(workspace) && workspace.displayName === name);
  if (matches.length === 0) throw new SendTargetError(`"${name}" is not open in Orca`);
  if (matches.length > 1) throw new SendTargetError(`${matches.length} workspaces are named "${name}"`);
  const workspace = matches[0] as Workspace;

  const agentsByPane = new Map(
    workspace.agents.filter((agent) => agent.paneKey).map((agent) => [agent.paneKey, agent]),
  );
  const panes = terminals.flatMap((terminal) => {
    const key = paneKeyOf(terminal);
    const agent = key === undefined ? undefined : agentsByPane.get(key);
    return agent && terminalsForWorkspace([terminal], workspace.path).length > 0 ? [{ agent, terminal }] : [];
  });
  const live = panes.filter((pane) => canReceiveInput(pane.terminal));
  if (live.length === 0) {
    throw new SendTargetError(
      panes.length > 0
        ? `The agent pane in "${name}" does not identify as an agent — restart it in Orca`
        : `No live agent in "${name}"`,
    );
  }
  // An orphaned pane sits in no tab: a message there gets answered where nobody is looking.
  const visible = live.filter((pane) => !pane.terminal.orphaned);
  const candidates = visible.length > 0 ? visible : live;
  if (candidates.length > 1) {
    throw new SendTargetError(`${candidates.length} agents in "${name}" — pick one with Send to Agent`);
  }

  const { agent, terminal } = candidates[0] as (typeof candidates)[number];
  // Enter on an open permission or question prompt would pick whichever option is highlighted.
  if (agent.state === "waiting" || workspace.status === "permission") {
    throw new SendTargetError(`"${name}" is waiting for your answer — reply in Orca`);
  }
  if (agent.state === "unknown") throw new SendTargetError(`Orca reports no state for the agent in "${name}"`);
  return terminal.handle;
}
