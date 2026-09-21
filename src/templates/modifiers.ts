/** Launch modifiers toggled on the run screen before a template is fired. */

export const MODIFIER_IDS = ["pin", "huge"] as const;

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
];

export type ModifierOverrides = Partial<Record<ModifierId, boolean>>;

/** A template's defaults apply until the user overrides that modifier on the launch screen. */
export function resolveModifiers(
  template: { defaultModifiers?: ModifierId[] },
  overrides: ModifierOverrides = {},
): ModifierId[] {
  const defaults = new Set(template.defaultModifiers ?? []);
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
