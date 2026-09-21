import { Clipboard } from "@raycast/api";

/** One read per screen: a preview that expands `{clipboard}` must not re-read it on every keystroke. */
export async function readClipboardOnce(): Promise<string> {
  return (await Clipboard.readText()) ?? "";
}
