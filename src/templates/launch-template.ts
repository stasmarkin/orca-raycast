import { createWorkspace, type CreateWorkspaceResult } from "../orca/workspaces";
import { expandPlaceholders } from "./placeholders";
import type { WorkspaceTemplate } from "./template-file";

export async function launchTemplate(template: WorkspaceTemplate, input: string): Promise<CreateWorkspaceResult> {
  const context = { input };
  return createWorkspace({
    name: await expandPlaceholders(template.namePattern, context),
    repoSelector: template.repo,
    agent: template.agent,
    prompt: template.prompt ? await expandPlaceholders(template.prompt, context) : undefined,
    baseBranch: template.baseBranch,
    comment: template.comment ? await expandPlaceholders(template.comment, context) : undefined,
    setup: template.setup,
    noParent: template.noParent,
    activate: template.activate,
  });
}
