import { slugify } from "../templates/slugify";

// `wt` uses the name as an arc branch and as a path segment, and keeps `slot-*` for its review slots.
const VALID_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const RESERVED_PREFIX = "slot-";

/** A ticket key passes through as typed; free-form input is transliterated so `wt` never sees an invalid name. */
export function toWtWorktreeName(name: string): string {
  const trimmed = name.trim();
  if (VALID_NAME.test(trimmed) && !trimmed.startsWith(RESERVED_PREFIX)) return trimmed;

  const slug = slugify(trimmed);
  return slug.startsWith(RESERVED_PREFIX) ? `wt-${slug}` : slug;
}
