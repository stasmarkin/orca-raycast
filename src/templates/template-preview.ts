import { expandPlaceholdersWith, usesClipboardPlaceholder } from "./placeholders";
import type { WorkspaceTemplate } from "./template-file";
import { toWtWorktreeName } from "../wt/worktree-name";

/** Screens read the clipboard only for templates that spend it, not on every open. */
export function usesClipboard(template: WorkspaceTemplate): boolean {
  return usesClipboardPlaceholder(template.namePattern) || usesClipboardPlaceholder(template.prompt);
}

export type TemplatePreview = {
  /** Name the launch would give the checkout — slugified for arc, where `wt` validates it. Undefined for a send. */
  worktreeName: string | undefined;
  /** Undefined when the template carries no prompt, which is not the same as an empty one. */
  prompt: string | undefined;
};

/** A send without a prompt passes the input on as the whole message. */
export function templatePrompt(template: WorkspaceTemplate): string | undefined {
  return template.prompt ?? (template.send === undefined ? undefined : "{input}");
}

/**
 * What a launch would produce, for the screens to show before it happens. Synchronous on purpose:
 * the clipboard is read once per screen so a preview cannot re-read it on every keystroke.
 */
export function previewTemplate(template: WorkspaceTemplate, input: string, clipboard: string): TemplatePreview {
  const values = { input: input.trim(), clipboard };
  const name = template.namePattern === undefined ? undefined : expandPlaceholdersWith(template.namePattern, values);
  const prompt = templatePrompt(template);

  return {
    worktreeName: name !== undefined && template.worktree === "arc" ? toWtWorktreeName(name) : name,
    prompt: prompt === undefined ? undefined : expandPlaceholdersWith(prompt, values),
  };
}
