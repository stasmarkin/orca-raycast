import { Clipboard } from "@raycast/api";
import { slugify } from "./slugify";

export type PlaceholderContext = { input: string };

// Clipboard contents land in argv, a branch name and an agent brief; a copied file would blow past ARG_MAX.
const CLIPBOARD_MAX_LENGTH = 4096;

/** Expands `{input}`, `{slug}`, `{date}`, `{time}` and `{clipboard}`; unknown placeholders are left as-is. */
export async function expandPlaceholders(template: string, context: PlaceholderContext): Promise<string> {
  const needsClipboard = template.includes("{clipboard}");
  const clipboard = needsClipboard ? ((await Clipboard.readText()) ?? "").slice(0, CLIPBOARD_MAX_LENGTH) : "";
  const now = new Date();

  const values: Record<string, string> = {
    input: context.input,
    slug: slugify(context.input),
    clipboard,
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5).replace(":", ""),
  };

  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
