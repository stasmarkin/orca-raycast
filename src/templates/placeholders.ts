import { Clipboard } from "@raycast/api";
import { slugify } from "./slugify";

export type PlaceholderContext = { input: string };

/** Expands `{input}`, `{slug}`, `{date}`, `{time}` and `{clipboard}`; unknown placeholders are left as-is. */
export async function expandPlaceholders(template: string, context: PlaceholderContext): Promise<string> {
  const needsClipboard = template.includes("{clipboard}");
  const clipboard = needsClipboard ? ((await Clipboard.readText()) ?? "") : "";
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
