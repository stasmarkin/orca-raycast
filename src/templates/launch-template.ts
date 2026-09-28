import { createWorkspace, findMainWorkspace, pinWorkspace, workspaceSelector } from "../orca/workspaces";
import { createTerminal, sendToTerminal, terminalAcceptsInput, waitForTuiIdle } from "../orca/terminals";
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

  if (template.worktree === "main") {
    return runInMainCheckout(template, {
      title: name,
      command: isHuge ? (options.orchestrator?.command ?? DEFAULT_ORCHESTRATOR_COMMAND) : template.agent,
      brief: isHuge ? briefWithOrchestratorPrefix(prompt ?? trimmed, options.orchestrator) : prompt,
      repoSelector: resolveRepoSelector(template.repo, options.repoSelector),
      pin: modifiers.includes("pin"),
    });
  }

  const created =
    template.worktree === "arc"
      ? await createArcWorkspace(template, { name, agent, prompt: brief })
      : {
          result: await createWorkspace({
            name,
            repoSelector: resolveRepoSelector(template.repo, options.repoSelector),
            agent,
            prompt: brief,
            baseBranch: template.baseBranch,
            comment: template.comment ? await expandPlaceholders(template.comment, context) : undefined,
            setup: template.setup,
            noParent: template.noParent,
            activate: template.activate,
          }),
          warning: undefined,
        };
  const result = created.result;
  const warnings: string[] = created.warning === undefined ? [] : [created.warning];
  const selector = createdWorkspaceSelector(result);
  let handle = result.agentTerminalHandle ?? result.startupTerminal?.handle;

  if (isHuge) {
    if (!selector) warnings.push("Orca returned no workspace id, so the orchestrator was not started");
    else {
      try {
        const started = await startOrchestrator(selector, prompt ?? trimmed, options.orchestrator);
        handle = started.handle;
        if (started.warning) warnings.push(started.warning);
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
 * No checkout: the agent starts in the folder the repository itself lives in. For a question that
 * only reads the code, a branch of its own is a cost with nothing to show for it — but every launch
 * here shares one working tree, so two agents editing at once would collide.
 */
async function runInMainCheckout(
  template: WorkspaceTemplate,
  request: {
    title: string;
    command: string | undefined;
    brief: string | undefined;
    repoSelector: string | undefined;
    pin: boolean;
  },
): Promise<LaunchOutcome> {
  if (!request.repoSelector) throw new Error(`Template "${template.id}" runs in the repo folder but names no repo`);
  if (!request.command) throw new Error(`Template "${template.id}" runs in the repo folder but names no agent`);

  const main = await findMainWorkspace(request.repoSelector);
  if (!main) throw new Error(`Orca knows no main checkout for ${request.repoSelector}`);

  const selector = workspaceSelector(main.id);
  const warnings: string[] = [];
  const { handle, warning } = await startAgent(selector, request.command, request.title, request.brief);
  if (warning) warnings.push(warning);

  if (request.pin) {
    try {
      await pinWorkspace(selector);
    } catch (error) {
      warnings.push(`Not pinned: ${(error as Error).message}`);
    }
  }

  return {
    result: {
      worktree: { id: main.id, path: main.path, displayName: main.displayName || undefined },
      agentTerminalHandle: handle,
    },
    handle,
    warnings,
  };
}

/**
 * Arcadia is not git, so the checkout, its Orca folder project and the agent are all made by `wt`.
 * Its answer is reshaped into Orca's so that pinning, the orchestrator and activation stay one code path.
 */
async function createArcWorkspace(
  template: WorkspaceTemplate,
  request: { name: string; agent?: string; prompt?: string },
): Promise<{ result: CreateWorkspaceResult; warning: string | undefined }> {
  // The template schema already requires it; this keeps a hand-edited file from calling `wt` half-configured.
  if (!template.project) throw new Error(`Template "${template.id}" uses arc but names no project`);

  const worktree = await createArcWorktree({
    ...request,
    name: toWtWorktreeName(request.name),
    project: template.project,
  });
  // `wt` exits 0 with the checkout built even when the agent never took the brief; silence here
  // would show "Workspace created" over an agent sitting with an empty prompt.
  const warning =
    request.agent !== undefined && request.prompt !== undefined && !worktree.promptSent
      ? `Brief not delivered: ${worktree.promptError ?? "reason unknown"} — send it by hand`
      : undefined;

  return {
    warning,
    result: {
      worktree: { id: worktree.worktreeId, path: worktree.path, displayName: worktree.name || undefined },
      agentTerminalHandle: worktree.agentTerminalHandle ?? undefined,
    },
  };
}

/**
 * Starts an agent in a workspace that already exists and types the brief once its TUI is up. The
 * terminal is reported even when the brief never lands: it exists, and saying otherwise would send
 * the caller looking for a pane that is sitting right there.
 */
async function startAgent(
  selector: string,
  command: string,
  title: string,
  brief: string | undefined,
): Promise<{ handle: string; warning?: string }> {
  const handle = await createTerminal(selector, command, title);
  if (brief === undefined || brief.length === 0) return { handle };

  try {
    // Both gates guard the same accident: a command that never became an agent leaves a plain shell,
    // and typing the brief with Enter into it would run the task description as shell commands.
    if (!(await waitForTuiIdle(handle, TUI_READY_TIMEOUT_MS))) {
      throw new Error("it never reached idle");
    }
    if (!(await terminalAcceptsInput(handle))) {
      throw new Error("the pane is not an agent");
    }
    // A newline inside the TUI submits, so the whole brief has to arrive as one line.
    await sendToTerminal(handle, brief.replace(/\s*\n\s*/g, " "), true);
    return { handle };
  } catch (error) {
    return { handle, warning: `Brief not typed: ${(error as Error).message} — send it by hand` };
  }
}

function briefWithOrchestratorPrefix(brief: string, config: OrchestratorConfig | undefined): string {
  return composeBrief(config?.promptPrefix ?? DEFAULT_ORCHESTRATOR_PROMPT_PREFIX, brief);
}

async function startOrchestrator(
  selector: string,
  brief: string,
  config: OrchestratorConfig | undefined,
): Promise<{ handle: string; warning?: string }> {
  const command = config?.command ?? DEFAULT_ORCHESTRATOR_COMMAND;
  return startAgent(selector, command, "orchestrator", briefWithOrchestratorPrefix(brief, config));
}

/**
 * `{brief}` is substituted with a function so `$&` and friends inside the task survive, and a prefix
 * that forgot the placeholder gets the brief appended rather than dropping it.
 */
export function composeBrief(prefix: string, brief: string): string {
  const composed = prefix.includes("{brief}") ? prefix.replace("{brief}", () => brief) : `${prefix} ${brief}`;
  // A newline inside the TUI submits, so the whole brief has to arrive as one line.
  return composed.replace(/\s*\n\s*/g, " ");
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
