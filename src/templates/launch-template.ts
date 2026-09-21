import { createWorkspace, pinWorkspace, workspaceSelector } from "../orca/workspaces";
import { createTerminal, sendToTerminal, waitForTuiIdle } from "../orca/terminals";
import type { CreateWorkspaceResult } from "../orca/types";
import { OrcaTimeoutError } from "../orca/invoke";
import { createArcWorktree, WtTimeoutError } from "../wt/worktrees";
import { toWtWorktreeName } from "../wt/worktree-name";
import { expandPlaceholders } from "./placeholders";
import type { ModifierId } from "./modifiers";
import { resolveRepoSelector } from "./repo-selection";
import {
  DEFAULT_ORCHESTRATOR_COMMAND,
  DEFAULT_ORCHESTRATOR_PROMPT_PREFIX,
  type OrchestratorConfig,
  type WorkspaceTemplate,
} from "./template-file";

// The orchestrator TUI has to finish booting before its brief is typed in.
const TUI_READY_TIMEOUT_MS = 120_000;

export class TemplateInputRequired extends Error {
  constructor(title: string) {
    super(`${title} needs an input value`);
    this.name = "TemplateInputRequired";
  }
}

export type LaunchOutcome = {
  result: CreateWorkspaceResult;
  /** Terminal to reveal: the orchestrator pane when one was started, otherwise the template's agent. */
  handle?: string;
  /** Steps that failed after the workspace itself was created, so the UI can report a partial success. */
  warnings: string[];
};

export type LaunchOptions = {
  modifiers?: ModifierId[];
  orchestrator?: OrchestratorConfig;
  /** Used when the template does not name a repo; Raycast never runs inside an Orca worktree. */
  repoSelector?: string;
};

/** Both launch paths (form and hotkey) go through here so `requiresInput` cannot be bypassed by one of them. */
export async function launchTemplate(
  template: WorkspaceTemplate,
  input: string,
  options: LaunchOptions = {},
): Promise<LaunchOutcome> {
  const trimmed = input.trim();
  if (template.requiresInput && !trimmed) throw new TemplateInputRequired(template.title);

  const modifiers = options.modifiers ?? [];
  const isHuge = modifiers.includes("huge");
  const context = { input: trimmed };
  const prompt = template.prompt ? await expandPlaceholders(template.prompt, context) : undefined;
  const name = await expandPlaceholders(template.namePattern, context);
  // The orchestrator is launched as its own terminal, because neither CLI can pick a model for its agent.
  const agent = isHuge ? undefined : template.agent;
  const brief = isHuge ? undefined : prompt;

  const result =
    template.worktree === "arc"
      ? await createArcWorkspace(template, { name, agent, prompt: brief })
      : await createWorkspace({
          name,
          repoSelector: resolveRepoSelector(template.repo, options.repoSelector),
          agent,
          prompt: brief,
          baseBranch: template.baseBranch,
          comment: template.comment ? await expandPlaceholders(template.comment, context) : undefined,
          setup: template.setup,
          noParent: template.noParent,
          activate: template.activate,
        });
  const warnings: string[] = [];
  const selector = createdWorkspaceSelector(result);
  let handle = result.agentTerminalHandle ?? result.startupTerminal?.handle;

  if (isHuge) {
    if (!selector) warnings.push("Orca returned no workspace id, so the orchestrator was not started");
    else {
      try {
        handle = await startOrchestrator(selector, prompt ?? trimmed, options.orchestrator);
      } catch (error) {
        warnings.push(`Orchestrator not started: ${(error as Error).message}`);
      }
    }
  }

  if (modifiers.includes("pin")) {
    if (!selector) warnings.push("Orca returned no workspace id, so it was not pinned");
    else {
      try {
        await pinWorkspace(selector);
      } catch (error) {
        warnings.push(`Not pinned: ${(error as Error).message}`);
      }
    }
  }

  return { result, handle, warnings };
}

/**
 * Arcadia is not git, so the checkout, its Orca folder project and the agent are all made by `wt`.
 * Its answer is reshaped into Orca's so that pinning, the orchestrator and activation stay one code path.
 */
async function createArcWorkspace(
  template: WorkspaceTemplate,
  request: { name: string; agent?: string; prompt?: string },
): Promise<CreateWorkspaceResult> {
  // The template schema already requires it; this keeps a hand-edited file from calling `wt` half-configured.
  if (!template.project) throw new Error(`Template "${template.id}" uses arc but names no project`);

  const worktree = await createArcWorktree({
    ...request,
    name: toWtWorktreeName(request.name),
    project: template.project,
  });
  return {
    worktree: { id: worktree.worktreeId, path: worktree.path, displayName: worktree.name || undefined },
    agentTerminalHandle: worktree.agentTerminalHandle ?? undefined,
  };
}

async function startOrchestrator(
  selector: string,
  brief: string,
  config: OrchestratorConfig | undefined,
): Promise<string> {
  const command = config?.command ?? DEFAULT_ORCHESTRATOR_COMMAND;
  const prefix = config?.promptPrefix ?? DEFAULT_ORCHESTRATOR_PROMPT_PREFIX;

  const handle = await createTerminal(selector, command, "orchestrator");
  await waitForTuiIdle(handle, TUI_READY_TIMEOUT_MS);
  // A newline inside the TUI submits, so the whole brief has to arrive as one line.
  await sendToTerminal(handle, prefix.replace("{brief}", brief).replace(/\s*\n\s*/g, " "), true);
  return handle;
}

function createdWorkspaceSelector(result: CreateWorkspaceResult): string | undefined {
  if (result.worktree?.id) return workspaceSelector(result.worktree.id);
  if (result.worktree?.path) return `path:${result.worktree.path}`;
  return undefined;
}

/** Either CLI may outlive its timeout and still finish the workspace, which is not the same as failing. */
export function stillRunning(error: unknown): boolean {
  return error instanceof OrcaTimeoutError || error instanceof WtTimeoutError;
}

/** A template matched by title is ambiguous when titles repeat; only `id` is guaranteed unique. */
export function findTemplate<T extends { id: string; title: string }>(items: T[], query: string): T {
  const byId = items.find((item) => item.id === query);
  if (byId) return byId;

  const needle = query.toLowerCase();
  const byTitle = items.filter((item) => item.title.toLowerCase() === needle);
  if (byTitle.length > 1) throw new Error(`"${query}" matches ${byTitle.length} entries — use the id instead`);
  if (byTitle.length === 0) throw new Error(`No entry matches "${query}"`);
  return byTitle[0] as T;
}
