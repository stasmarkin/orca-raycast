/** Subset of the Orca CLI payloads this extension reads. Unlisted fields are ignored on purpose. */

export type AgentState = "working" | "waiting" | "done" | (string & {});

export type WorkspaceStatus = "inactive" | "active" | "working" | "permission" | (string & {});

export type WorkspaceAgent = {
  paneKey: string;
  state: AgentState;
  agentType: string | null;
  prompt: string | null;
  taskTitle: string | null;
  displayName: string | null;
  toolName: string | null;
  interrupted: boolean;
  stateStartedAt: number | null;
  updatedAt: number | null;
};

export type LinkedPullRequest = { number: number; state: string };

export type Workspace = {
  workspaceKind: "git" | "folder-workspace" | (string & {});
  worktreeId: string;
  repoId: string;
  repo: string;
  path: string;
  branch: string;
  displayName: string;
  workspaceStatus: string | null;
  comment: string;
  isArchived: boolean;
  isMainWorktree: boolean;
  isPinned: boolean;
  isActive: boolean;
  unread: boolean;
  liveTerminalCount: number;
  lastActivityAt: number | null;
  lastOutputAt: number | null;
  preview: string | null;
  status: WorkspaceStatus;
  linkedPR: LinkedPullRequest | null;
  linkedIssue: number | null;
  agents: WorkspaceAgent[];
};

export type WorkspaceListResult = { worktrees: Workspace[]; totalCount: number; truncated: boolean };

export type Terminal = {
  handle: string;
  worktreeId: string;
  worktreePath: string;
  branch: string;
  title: string;
  connected: boolean;
  writable: boolean;
  orphaned: boolean;
  lastOutputAt: number | null;
  preview: string | null;
  agentIdentity: string | null;
};

export type TerminalListResult = { terminals: Terminal[]; totalCount: number; truncated: boolean };

export type TerminalTail = {
  handle: string;
  status: string;
  tail: string[];
  truncated: boolean;
  latestCursor: string;
  returnedLineCount: number;
};

export type Repo = {
  id: string;
  displayName: string;
  path: string;
  badgeColor: string | null;
  kind: "git" | "folder" | (string & {});
};

export type Automation = {
  id: string;
  name: string;
  prompt: string;
  agentId: string;
  enabled: boolean;
  rrule: string;
  nextRunAt: number | null;
  lastRunAt?: number;
};

/** True when the workspace is blocked on the user rather than making progress on its own. */
export function needsAttention(workspace: Workspace): boolean {
  return workspace.status === "permission" || workspace.agents.some((agent) => agent.state === "waiting");
}
