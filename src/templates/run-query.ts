import type { WorkspaceTemplate } from "./template-file";

export type RunQuery = {
  /** First word: which template to run. */
  templateQuery: string;
  /** Everything after it, fed to the template as `{input}`. */
  input: string;
};

/** Splits `pp STARTREK-789 something` into the template id and its input. */
export function parseRunQuery(searchText: string): RunQuery {
  const trimmed = searchText.trimStart();
  const boundary = trimmed.search(/\s/);
  if (boundary === -1) return { templateQuery: trimmed.trim(), input: "" };
  return { templateQuery: trimmed.slice(0, boundary), input: trimmed.slice(boundary + 1).trim() };
}

/**
 * Templates matching the first word, the exact id first so a complete id is never left below a
 * longer one. The rest stay listed: hiding them makes `pp` unreachable from `ppq` and back.
 */
export function matchTemplates(templates: WorkspaceTemplate[], query: string): WorkspaceTemplate[] {
  if (!query) return templates;

  const needle = query.toLowerCase();
  const matching = templates.filter(
    (template) => template.id.toLowerCase().includes(needle) || template.title.toLowerCase().includes(needle),
  );

  return [...matching].sort((left, right) => rank(left, needle) - rank(right, needle));
}

function rank(template: WorkspaceTemplate, needle: string): number {
  if (template.id.toLowerCase() === needle) return 0;
  return template.id.toLowerCase().startsWith(needle) ? 1 : 2;
}
