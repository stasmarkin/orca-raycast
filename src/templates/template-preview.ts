import { expandPlaceholdersWith, usesClipboardPlaceholder } from "./placeholders";
import type { WorkspaceTemplate } from "./template-file";
import { toWtWorktreeName } from "../wt/worktree-name";

/** Screens read the clipboard only for templates that spend it, not on every open. */
export function usesClipboard(template: WorkspaceTemplate): boolean {
  return usesClipboardPlaceholder(template.namePattern) || usesClipboardPlaceholder(template.prompt);
}

export type TemplatePreview = {
  /** Name the launch would give the checkout — slugified for arc, where `wt` validates it. */
  worktreeName: string;
  /** Undefined when the template carries no prompt, which is not the same as an empty one. */
  prompt: string | undefined;
};

/**
 * What a launch would produce, for the screens to show before it happens. Synchronous on purpose:
 * the clipboard is read once per screen so a preview cannot re-read it on every keystroke.
 */
export function previewTemplate(template: WorkspaceTemplate, input: string, clipboard: string): TemplatePreview {
  const values = { input: input.trim(), clipboard };
  const name = expandPlaceholdersWith(template.namePattern, values);

  return {
    worktreeName: template.worktree === "arc" ? toWtWorktreeName(name) : name,
    prompt: template.prompt === undefined ? undefined : expandPlaceholdersWith(template.prompt, values),
  };
}
