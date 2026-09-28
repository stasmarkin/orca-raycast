import { z } from "zod";
import { invokeOrca } from "./invoke";
import {
  CreateWorkspaceSchema,
  RepoListSchema,
  WorkspaceListSchema,
  WorktreeListSchema,
  type CreateWorkspaceResult,
  type Repo,
  type Workspace,
  type WorkspaceList,
} from "./types";

// Orca caps `worktree ps` at 200 and reports the rest only through `truncated`; a host with more
// workspaces would silently hide the ones waiting on you.
const LIST_LIMIT = 2000;

export async function listWorkspaces(): Promise<WorkspaceList> {
  // `worktree ps` carries agent state and previews; `worktree list` does not.
  return invokeOrca(["worktree", "ps", `--limit=${LIST_LIMIT}`], WorkspaceListSchema);
}

export async function listRepos(): Promise<Repo[]> {
  const result = await invokeOrca(["repo", "list"], RepoListSchema);
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

export async function createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult> {
  const args = ["worktree", "create", `--name=${input.name}`];
  if (input.repoSelector) args.push(`--repo=${input.repoSelector}`);
  if (input.baseBranch) args.push(`--base-branch=${input.baseBranch}`);
  if (input.agent) args.push(`--agent=${input.agent}`);
  if (input.prompt) args.push(`--prompt=${input.prompt}`);
  if (input.comment) args.push(`--comment=${input.comment}`);
  if (input.setup) args.push(`--setup=${input.setup}`);
  if (input.noParent) args.push("--no-parent");
  if (input.activate) args.push("--activate");

  // Worktree creation runs setup hooks and an agent launch; the default timeout is too tight.
  return invokeOrca(args, CreateWorkspaceSchema, { timeoutMs: 180_000 });
}

/**
 * Removes a worktree. Without `force` Orca refuses when the checkout is dirty or an agent is live,
 * which is the only warning the user gets before uncommitted work is destroyed.
 */
export async function removeWorkspace(worktreeId: string, options: { force: boolean }): Promise<void> {
  const args = ["worktree", "rm", `--worktree=${workspaceSelector(worktreeId)}`];
  if (options.force) args.push("--force");
  await invokeOrca(args, z.unknown(), { timeoutMs: 120_000 });
}

export async function pinWorkspace(selector: string): Promise<void> {
  await invokeOrca(["worktree", "set", `--worktree=${selector}`, "--pin"], z.unknown());
}

/** `id:` is the only form scoped to one repo, so it can never resolve ambiguously. */
export function workspaceSelector(worktreeId: string): string {
  return `id:${worktreeId}`;
}

export type MainWorkspace = { id: string; path: string; displayName: string };

/**
 * The checkout the repo itself lives in — the one a template runs in when it wants the repository
 * as it is, without a branch of its own. Both git repos and folder projects report one.
 */
export async function findMainWorkspace(repoSelector: string): Promise<MainWorkspace | undefined> {
  const result = await invokeOrca(["worktree", "list", `--repo=${repoSelector}`], WorktreeListSchema);
  return result.worktrees.find((worktree) => worktree.isMainWorktree);
}

/** `worktree show/set/rm` only ever look at git worktrees; folder workspaces are not in their candidate set. */
export function supportsWorktreeMetadataCommands(workspace: Workspace): boolean {
  return workspace.workspaceKind !== "folder-workspace";
}
