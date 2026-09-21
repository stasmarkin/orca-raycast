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
 * Templates matching the first word. An exact id wins outright so that typing a complete id never
 * leaves a longer-named template selected above it.
 */
export function matchTemplates(templates: WorkspaceTemplate[], query: string): WorkspaceTemplate[] {
  if (!query) return templates;

  const needle = query.toLowerCase();
  const exact = templates.filter((template) => template.id.toLowerCase() === needle);
  if (exact.length > 0) return exact;

  return templates.filter(
    (template) => template.id.toLowerCase().includes(needle) || template.title.toLowerCase().includes(needle),
  );
}
