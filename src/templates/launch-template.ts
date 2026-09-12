import { createWorkspace, type CreateWorkspaceInput } from "../orca/workspaces";
import type { CreateWorkspaceResult } from "../orca/types";
import { expandPlaceholders } from "./placeholders";
import type { WorkspaceTemplate } from "./template-file";

export class TemplateInputRequired extends Error {
  constructor(title: string) {
    super(`${title} needs an input value`);
    this.name = "TemplateInputRequired";
  }
}

/** Both launch paths (form and hotkey) go through here so `requiresInput` cannot be bypassed by one of them. */
export async function launchTemplate(template: WorkspaceTemplate, input: string): Promise<CreateWorkspaceResult> {
  const trimmed = input.trim();
  if (template.requiresInput && !trimmed) throw new TemplateInputRequired(template.title);

  const context = { input: trimmed };
  const request: CreateWorkspaceInput = {
    name: await expandPlaceholders(template.namePattern, context),
    repoSelector: template.repo,
    agent: template.agent,
    prompt: template.prompt ? await expandPlaceholders(template.prompt, context) : undefined,
    baseBranch: template.baseBranch,
    comment: template.comment ? await expandPlaceholders(template.comment, context) : undefined,
    setup: template.setup,
    noParent: template.noParent,
    activate: template.activate,
  };
  return createWorkspace(request);
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
