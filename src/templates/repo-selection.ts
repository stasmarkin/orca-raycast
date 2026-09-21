import { LocalStorage } from "@raycast/api";

const STORAGE_KEY = "defaultRepoSelector";

/**
 * Which repo a launch targets. Orca can infer it from the cwd, but Raycast never runs inside an
 * Orca worktree, so it has to be supplied explicitly.
 */
export function resolveRepoSelector(
  templateRepo: string | undefined,
  fallback: string | undefined,
): string | undefined {
  return templateRepo ?? (fallback || undefined);
}

export async function readDefaultRepo(): Promise<string | undefined> {
  return (await LocalStorage.getItem<string>(STORAGE_KEY)) || undefined;
}

/** Shared with the no-view launch path, which has no UI to pick a repo in. */
export async function writeDefaultRepo(selector: string): Promise<void> {
  if (selector) await LocalStorage.setItem(STORAGE_KEY, selector);
}
