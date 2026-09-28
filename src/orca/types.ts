import { z } from "zod";

/**
 * Runtime schemas for the Orca CLI payloads this extension reads. Orca ships independently of the
 * extension, so a renamed or dropped field must degrade one list item, not crash the command.
 *
 * Optional fields use `.catch()` rather than `.default()`: a default only fires on `undefined`, so a
 * field that turns into `null` would fail validation and take the whole list with it.
 */

const timestamp = z.number().nullable().catch(null);

/**
 * Drops unparseable entries instead of failing the list. A single malformed record must not make a
 * waiting agent invisible, which is exactly what `z.array(...).catch([])` would do.
 *
 * The array itself stays required: a missing or renamed container is a broken contract, and turning
 * that into an empty list would report "nobody is waiting" for an Orca that never answered.
 */
function arrayOfValid<S extends z.ZodType>(schema: S) {
  return z.array(z.unknown()).transform((items) =>
    items.flatMap((item) => {
      const parsed = schema.safeParse(item);
      return parsed.success ? [parsed.data as z.infer<S>] : [];
    }),
  );
}

export const AgentSchema = z.object({
  paneKey: z.string().catch(""),
  state: z.string().catch("unknown"),
  agentType: z.string().nullable().catch(null),
  prompt: z.string().nullable().catch(null),
  taskTitle: z.string().nullable().catch(null),
  displayName: z.string().nullable().catch(null),
  toolName: z.string().nullable().catch(null),
  interrupted: z.boolean().catch(false),
  stateStartedAt: timestamp,
  updatedAt: timestamp,
});

export const LinkedPullRequestSchema = z.object({
  number: z.number(),
  state: z.string().catch("open"),
});

export const WorkspaceSchema = z.object({
  workspaceKind: z.string().catch("git"),
  worktreeId: z.string(),
  repoId: z.string().catch(""),
  repo: z.string().catch(""),
  path: z.string().catch(""),
  branch: z.string().catch(""),
  displayName: z.string().catch(""),
  /** User-facing lane (e.g. `in-progress`); distinct from `status`, which tracks the agent. */
  workspaceStatus: z.string().nullable().catch(null),
  comment: z.string().catch(""),
  isArchived: z.boolean().catch(false),
  isMainWorktree: z.boolean().catch(false),
  isPinned: z.boolean().catch(false),
  isActive: z.boolean().catch(false),
  unread: z.boolean().catch(false),
  liveTerminalCount: z.number().catch(0),
  lastActivityAt: timestamp,
  lastOutputAt: timestamp,
  preview: z.string().nullable().catch(null),
  status: z.string().catch("inactive"),
  linkedPR: LinkedPullRequestSchema.nullable().catch(null),
  linkedIssue: z.number().nullable().catch(null),
  // Per-workspace, so a broken agents field degrades one row rather than the whole listing.
  agents: arrayOfValid(AgentSchema).catch([]),
});

export const WorkspaceListSchema = z.object({
  worktrees: arrayOfValid(WorkspaceSchema),
  totalCount: z.number().catch(0),
  truncated: z.boolean().catch(false),
});

export const TerminalSchema = z.object({
  handle: z.string(),
  worktreeId: z.string().catch(""),
  worktreePath: z.string().catch(""),
  branch: z.string().catch(""),
  title: z.string().catch(""),
  connected: z.boolean().catch(false),
  writable: z.boolean().catch(false),
  orphaned: z.boolean().catch(false),
  lastOutputAt: timestamp,
  preview: z.string().nullable().catch(null),
  agentIdentity: z.string().nullable().catch(null),
});

export const TerminalListSchema = z.object({
  terminals: arrayOfValid(TerminalSchema),
  totalCount: z.number().catch(0),
  truncated: z.boolean().catch(false),
});

export const TerminalTailSchema = z.object({
  terminal: z.object({
    handle: z.string().catch(""),
    status: z.string().catch("unknown"),
    tail: z.array(z.string()).catch([]),
    truncated: z.boolean().catch(false),
    returnedLineCount: z.number().catch(0),
  }),
});

/** Orca has shipped both shapes; `wt` reads them the same way, so a version skew is not an error. */
export const CreateTerminalSchema = z.object({
  terminal: z.object({ handle: z.string(), worktreeId: z.string().catch("") }).optional(),
  handle: z.string().optional(),
});

export const TerminalWaitSchema = z.object({
  satisfied: z.boolean().optional(),
  wait: z.object({ satisfied: z.boolean().optional() }).optional(),
});

export const RepoListSchema = z.object({
  repos: z.array(
    z.object({
      id: z.string(),
      displayName: z.string().catch(""),
      path: z.string().catch(""),
      kind: z.string().catch("git"),
    }),
  ),
});

export const AutomationListSchema = z.object({
  automations: z.array(
    z.object({
      id: z.string(),
      name: z.string().catch(""),
      prompt: z.string().catch(""),
      agentId: z.string().catch(""),
      enabled: z.boolean().catch(true),
      rrule: z.string().catch(""),
      nextRunAt: timestamp,
      lastRunAt: timestamp,
    }),
  ),
});

export const CreateWorkspaceSchema = z.object({
  worktree: z
    .object({
      id: z.string().optional(),
      path: z.string().optional(),
      branch: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
  agentTerminalHandle: z.string().optional(),
  startupTerminal: z.object({ handle: z.string().optional() }).optional(),
});

export type WorkspaceAgent = z.infer<typeof AgentSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceList = z.infer<typeof WorkspaceListSchema>;
export type Terminal = z.infer<typeof TerminalSchema>;
export type TerminalList = z.infer<typeof TerminalListSchema>;
export type TerminalTail = z.infer<typeof TerminalTailSchema>["terminal"];
export type Repo = z.infer<typeof RepoListSchema>["repos"][number];
export type Automation = z.infer<typeof AutomationListSchema>["automations"][number];
export type CreateWorkspaceResult = z.infer<typeof CreateWorkspaceSchema>;

/** True when the workspace is blocked on the user rather than making progress on its own. */
export function needsAttention(workspace: Workspace): boolean {
  return workspace.status === "permission" || workspace.agents.some((agent) => agent.state === "waiting");
}

/** Archived workspaces keep reporting agent state, so every reader has to drop them, not just the search list. */
export function isVisible(workspace: Workspace): boolean {
  return !workspace.isArchived;
}
