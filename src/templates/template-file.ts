import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";

export const TEMPLATE_FILE = join(homedir(), ".config", "orca-raycast", "templates.json");

const TemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** Repo selector as understood by `orca worktree create --repo`, e.g. `name:orca`. */
  repo: z.string().min(1).optional(),
  namePattern: z.string().min(1),
  baseBranch: z.string().min(1).optional(),
  agent: z.string().min(1).optional(),
  prompt: z.string().optional(),
  comment: z.string().optional(),
  setup: z.enum(["run", "skip", "inherit"]).optional(),
  noParent: z.boolean().optional(),
  activate: z.boolean().optional(),
  /** Prompt the user for the `{input}` value when the template is launched without one. */
  requiresInput: z.boolean().optional(),
});

const TemplateFileSchema = z.object({ templates: z.array(TemplateSchema) });

export type WorkspaceTemplate = z.infer<typeof TemplateSchema>;

export class TemplateFileError extends Error {}

const STARTER_FILE: z.infer<typeof TemplateFileSchema> = {
  templates: [
    {
      id: "review",
      title: "Review a PR",
      repo: "name:orca",
      namePattern: "review-{slug}",
      agent: "claude",
      prompt: "Сделай ревью {input}. Начни с анализа и плана, к коду без ок не приступай, не коммить.",
      noParent: true,
      requiresInput: true,
    },
  ],
};

export async function readTemplates(): Promise<WorkspaceTemplate[]> {
  let raw: string;
  try {
    raw = await readFile(TEMPLATE_FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TemplateFileError(`${TEMPLATE_FILE} is not valid JSON`);
  }

  const result = TemplateFileSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new TemplateFileError(`${TEMPLATE_FILE}: ${first?.path.join(".")} ${first?.message}`);
  }

  const ids = new Set<string>();
  for (const template of result.data.templates) {
    if (ids.has(template.id)) throw new TemplateFileError(`${TEMPLATE_FILE}: duplicate template id "${template.id}"`);
    ids.add(template.id);
  }
  return result.data.templates;
}

/** Writes the starter file so the user has something to edit; never overwrites an existing one. */
export async function ensureTemplateFile(): Promise<string> {
  try {
    await readFile(TEMPLATE_FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(dirname(TEMPLATE_FILE), { recursive: true });
    await writeFile(TEMPLATE_FILE, `${JSON.stringify(STARTER_FILE, null, 2)}\n`, "utf8");
  }
  return TEMPLATE_FILE;
}
