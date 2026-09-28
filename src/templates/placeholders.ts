import { Clipboard } from "@raycast/api";
import { slugify } from "./slugify";

export type PlaceholderContext = { input: string };

export type PlaceholderValues = PlaceholderContext & { clipboard: string };

// Clipboard contents land in argv, a branch name and an agent brief; a copied file would blow past ARG_MAX.
const CLIPBOARD_MAX_LENGTH = 4096;

const CLIPBOARD_PLACEHOLDER = "{clipboard}";

export function usesClipboardPlaceholder(text: string | undefined): boolean {
  return text?.includes(CLIPBOARD_PLACEHOLDER) ?? false;
}

/**
 * Placeholders that may be typed into the input itself — Raycast refuses to paste a long brief into
 * the search bar, so `{clipboard}` written there is the way around it. `{input}` is deliberately
 * missing: inside the input it could only mean itself.
 */
export function expandInputPlaceholders(input: string, clipboard: string): string {
  return substitute(input, typedValues(clipboard));
}

/** Expands `{input}`, `{slug}`, `{date}`, `{time}` and `{clipboard}`; unknown placeholders are left as-is. */
export function expandPlaceholdersWith(template: string, values: PlaceholderValues): string {
  // The input is expanded first and inserted verbatim afterwards, so a clipboard that happens to
  // contain a placeholder cannot expand a second time.
  const input = expandInputPlaceholders(values.input, values.clipboard);
  return substitute(template, { ...typedValues(values.clipboard), input, slug: slugify(input) });
}

/** Same expansion, reading the clipboard itself — the launch path, where it must be current. */
export async function expandPlaceholders(template: string, context: PlaceholderContext): Promise<string> {
  const needed = usesClipboardPlaceholder(template) || usesClipboardPlaceholder(context.input);
  const clipboard = needed ? ((await Clipboard.readText()) ?? "") : "";
  return expandPlaceholdersWith(template, { ...context, clipboard });
}

function typedValues(clipboard: string): Record<string, string> {
  const now = new Date();
  return {
    clipboard: clipboard.slice(0, CLIPBOARD_MAX_LENGTH),
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5).replace(":", ""),
  };
}

function substitute(text: string, table: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => table[key] ?? match);
}
