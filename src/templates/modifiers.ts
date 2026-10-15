/** Launch modifiers toggled on the run screen before a template is fired. */

export const MODIFIER_IDS = ["pin", "huge", "focus"] as const;

export type ModifierId = (typeof MODIFIER_IDS)[number];

export type ModifierSpec = {
  id: ModifierId;
  title: string;
  description: string;
  /** Digit pressed with Cmd to toggle it. */
  key: "1" | "2" | "3";
};

export const MODIFIERS: ModifierSpec[] = [
  {
    id: "pin",
    title: "Pin",
    description: "Pin the workspace to Orca's Pinned section",
    key: "1",
  },
  {
    id: "huge",
    title: "Huge Task",
    description: "Run an orchestrator that delegates to subagents instead of a single agent",
    key: "2",
  },
  {
    id: "focus",
    title: "Focus",
    description: "Switch Orca to the new workspace; otherwise it is created in the background",
    key: "3",
  },
];

export type ModifierOverrides = Partial<Record<ModifierId, boolean>>;

type ModifierDefaults = { defaultModifiers?: ModifierId[]; activate?: boolean };

/** `activate` predates the Focus toggle, so a template that sets it still starts with Focus on. */
export function templateDefaultModifiers(template: ModifierDefaults): ModifierId[] {
  const defaults = new Set(template.defaultModifiers ?? []);
  if (template.activate) defaults.add("focus");
  return MODIFIER_IDS.filter((id) => defaults.has(id));
}

/** A template's defaults apply until the user overrides that modifier on the launch screen. */
export function resolveModifiers(template: ModifierDefaults, overrides: ModifierOverrides = {}): ModifierId[] {
  const defaults = new Set(templateDefaultModifiers(template));
  return MODIFIER_IDS.filter((id) => overrides[id] ?? defaults.has(id));
}

export function isModifierId(value: string): value is ModifierId {
  return (MODIFIER_IDS as readonly string[]).includes(value);
}

/** Parses a `pin,huge` style list, ignoring blanks and unknown names. */
export function parseModifiers(value: string): ModifierId[] {
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(isModifierId);
}
