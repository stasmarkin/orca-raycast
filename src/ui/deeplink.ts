import { environment } from "@raycast/api";

/**
 * Deeplink to one of this extension's own commands. Bound to a hotkey by saving it as a Quicklink,
 * which is the only way to get a per-item shortcut out of Raycast's static command list.
 */
export function commandDeeplink(commandName: string, args: Record<string, string>): string {
  const base = `raycast://extensions/${environment.ownerOrAuthorName}/${environment.extensionName}/${commandName}`;
  const filled = Object.fromEntries(Object.entries(args).filter(([, value]) => value.length > 0));
  if (Object.keys(filled).length === 0) return base;
  return `${base}?arguments=${encodeURIComponent(JSON.stringify(filled))}`;
}
