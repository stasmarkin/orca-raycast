import { invokeOrca } from "./invoke";
import type { Repo, Workspace, WorkspaceListResult } from "./types";

export async function listWorkspaces(): Promise<Workspace[]> {
  // `worktree ps` carries agent state and previews; `worktree list` does not.
  const result = await invokeOrca<WorkspaceListResult>(["worktree", "ps"]);
  return result.worktrees;
}

export async function listRepos(): Promise<Repo[]> {
  const result = await invokeOrca<{ repos: Repo[] }>(["repo", "list"]);
  return result.repos;
}

export type CreateWorkspaceInput = {
  name: string;
  repoSelector?: string;
  agent?: string;
  prompt?: string;
  baseBranch?: string;
  comment?: string;
  setup?: "run" | "skip" | "inherit";
  noParent?: boolean;
  activate?: boolean;
};

export type CreateWorkspaceResult = {
  worktree?: { id?: string; path?: string; branch?: string; displayName?: string };
  agentTerminalHandle?: string;
  startupTerminal?: { handle?: string };
};

export async function createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult> {
  const args = ["worktree", "create", "--name", input.name];
  if (input.repoSelector) args.push("--repo", input.repoSelector);
  if (input.baseBranch) args.push("--base-branch", input.baseBranch);
  if (input.agent) args.push("--agent", input.agent);
  if (input.prompt) args.push("--prompt", input.prompt);
  if (input.comment) args.push("--comment", input.comment);
  if (input.setup) args.push("--setup", input.setup);
  if (input.noParent) args.push("--no-parent");
  if (input.activate) args.push("--activate");

  // Worktree creation runs setup hooks and an agent launch; the default timeout is too tight.
  return invokeOrca<CreateWorkspaceResult>(args, { timeoutMs: 180_000 });
}

export async function removeWorkspace(worktreeId: string): Promise<void> {
  await invokeOrca(["worktree", "rm", "--worktree", workspaceSelector(worktreeId), "--force"], {
    timeoutMs: 120_000,
  });
}

export async function setWorkspaceComment(worktreeId: string, comment: string): Promise<void> {
  await invokeOrca(["worktree", "set", "--worktree", workspaceSelector(worktreeId), "--comment", comment]);
}

/** `id:` is the only form scoped to one repo, so it can never resolve ambiguously. */
export function workspaceSelector(worktreeId: string): string {
  return `id:${worktreeId}`;
}

/** `worktree show/set/rm` only ever look at git worktrees; folder workspaces are not in their candidate set. */
export function supportsWorktreeMetadataCommands(workspace: Workspace): boolean {
  return workspace.workspaceKind !== "folder-workspace";
}
