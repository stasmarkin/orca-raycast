import { Clipboard } from "@raycast/api";
import { slugify } from "./slugify";

export type PlaceholderContext = { input: string };

export type PlaceholderValues = PlaceholderContext & { clipboard: string };

// Clipboard contents land in argv, a branch name and an agent brief; a copied file would blow past ARG_MAX.
const CLIPBOARD_MAX_LENGTH = 4096;

/** Expands `{input}`, `{slug}`, `{date}`, `{time}` and `{clipboard}`; unknown placeholders are left as-is. */
export function expandPlaceholdersWith(template: string, values: PlaceholderValues): string {
  const now = new Date();

  const table: Record<string, string> = {
    input: values.input,
    slug: slugify(values.input),
    clipboard: values.clipboard.slice(0, CLIPBOARD_MAX_LENGTH),
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5).replace(":", ""),
  };

  return template.replace(/\{(\w+)\}/g, (match, key: string) => table[key] ?? match);
}

/** Same expansion, reading the clipboard itself — the launch path, where it must be current. */
export async function expandPlaceholders(template: string, context: PlaceholderContext): Promise<string> {
  const clipboard = template.includes("{clipboard}") ? ((await Clipboard.readText()) ?? "") : "";
  return expandPlaceholdersWith(template, { ...context, clipboard });
}
