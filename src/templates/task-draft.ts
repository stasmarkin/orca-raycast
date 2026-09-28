import { LocalStorage } from "@raycast/api";
import { z } from "zod";
import { MODIFIER_IDS, type ModifierId, type ModifierOverrides } from "./modifiers";

/** One key per template, so a brief started for one workflow cannot be overwritten by another. */
const KEY_PREFIX = "taskDraft:";

/** Stored as the resolved set, not as overrides: what the checkboxes showed is what comes back. */
const DraftSchema = z.object({
  input: z.string().catch(""),
  modifiers: z.array(z.enum(MODIFIER_IDS)).catch([]),
  repo: z.string().catch(""),
});

export type TaskDraft = z.infer<typeof DraftSchema>;

/** A brief survives leaving the form: Raycast closes its window whenever focus moves elsewhere. */
export async function readTaskDraft(templateId: string): Promise<TaskDraft | undefined> {
  return parseDraft(await LocalStorage.getItem<string>(KEY_PREFIX + templateId));
}

/** Every unsent brief, keyed by template, so the list can say which workflow has one waiting. */
export async function readAllTaskDrafts(): Promise<Record<string, TaskDraft>> {
  const stored = await LocalStorage.allItems<Record<string, string>>();
  const drafts: Record<string, TaskDraft> = {};

  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(KEY_PREFIX)) continue;
    const draft = parseDraft(value);
    if (draft) drafts[key.slice(KEY_PREFIX.length)] = draft;
  }
  return drafts;
}

export async function writeTaskDraft(templateId: string, draft: TaskDraft): Promise<void> {
  await LocalStorage.setItem(KEY_PREFIX + templateId, JSON.stringify(draft));
}

export async function clearTaskDraft(templateId: string): Promise<void> {
  await LocalStorage.removeItem(KEY_PREFIX + templateId);
}

export function overridesFromDraft(modifiers: ModifierId[]): ModifierOverrides {
  return Object.fromEntries(MODIFIER_IDS.map((id) => [id, modifiers.includes(id)]));
}

function parseDraft(stored: string | undefined): TaskDraft | undefined {
  if (!stored) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return undefined;
  }

  const draft = DraftSchema.safeParse(parsed);
  // Nothing typed is not a draft: restoring one would resurrect a task that was abandoned empty.
  if (!draft.success || draft.data.input.trim().length === 0) return undefined;
  return draft.data;
}
