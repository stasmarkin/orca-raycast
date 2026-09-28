import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { MODIFIER_IDS } from "./modifiers";

export const TEMPLATE_FILE = join(homedir(), ".config", "orca-raycast", "templates.json");

const TemplateSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    /** Who makes the checkout: Orca itself, or `wt` for an arc worktree of Arcadia. */
    worktree: z.enum(["orca", "arc"]).optional(),
    /** Repo selector as understood by `orca worktree create --repo`, e.g. `name:orca`. */
    repo: z.string().min(1).optional(),
    /** Project as understood by `wt new --project`, e.g. `pp`. Arc templates only. */
    project: z.string().min(1).optional(),
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
    /** Modifiers pre-selected when this template is picked; still togglable before launch. */
    defaultModifiers: z.array(z.enum(MODIFIER_IDS)).optional(),
  })
  .superRefine((template, ctx) => {
    if (template.worktree === "arc" && !template.project) {
      ctx.addIssue({ code: "custom", path: ["project"], message: 'is required when worktree is "arc"' });
    }
  });

const OrchestratorSchema = z.object({
  /** Startup command for the orchestrating agent. It is launched instead of the template's agent. */
  command: z.string().min(1).optional(),
  /** Wrapped around the template's prompt; `{brief}` is replaced with it. */
  promptPrefix: z.string().optional(),
});

const TemplateFileSchema = z.object({
  templates: z.array(TemplateSchema),
  orchestrator: OrchestratorSchema.optional(),
});

export type WorkspaceTemplate = z.infer<typeof TemplateSchema>;
export type OrchestratorConfig = z.infer<typeof OrchestratorSchema>;
export type TemplateFile = z.infer<typeof TemplateFileSchema>;

export class TemplateFileError extends Error {}

export const DEFAULT_ORCHESTRATOR_COMMAND = "claude --model fable";

export const DEFAULT_ORCHESTRATOR_PROMPT_PREFIX =
  "Ты оркестратор этой задачи. Сам код не пишешь: разложи работу на подзадачи и веди её силами сабагентов, " +
  "сверяя результат и собирая его воедино. Начни с анализа и плана, к коду без моего ок не приступай, не коммить. Задача: {brief}";

const STARTER_FILE: TemplateFile = {
  templates: [
    {
      id: "pp",
      title: "Ticket → product requirements → implementation",
      namePattern: "{slug}",
      agent: "claude",
      prompt:
        "Задача {input}. Найди её и собери продуктовые требования из доступных источников. " +
        "Если что-то непонятно или есть развилки — задай мне вопросы до начала работы. " +
        "Затем реализуй и прогони цикл код-ревью через /cr.",
      requiresInput: true,
      noParent: true,
      defaultModifiers: ["pin"],
    },
    {
      id: "review",
      title: "Review a PR",
      namePattern: "review-{slug}",
      agent: "claude",
      prompt: "Review {input}. Start with analysis and a plan; do not write code or commit without an OK.",
      noParent: true,
      requiresInput: true,
    },
  ],
};

export async function readTemplateFile(): Promise<TemplateFile> {
  let raw: string;
  try {
    raw = await readFile(TEMPLATE_FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { templates: [] };
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
  return result.data;
}

export async function readTemplates(): Promise<WorkspaceTemplate[]> {
  return (await readTemplateFile()).templates;
}

/** Writes the starter file so the user has something to edit; never overwrites an existing one. */
export async function ensureTemplateFile(): Promise<string> {
  await mkdir(dirname(TEMPLATE_FILE), { recursive: true });
  try {
    // `wx` makes "create only if absent" atomic — a check-then-write would race an editor saving the file.
    await writeFile(TEMPLATE_FILE, `${JSON.stringify(STARTER_FILE, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return TEMPLATE_FILE;
}
