import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTerminal } from "../orca/terminals";

/** Cheap and fast: this pane exists to write one line, and the workspace is nameless until it does. */
const NAMER_MODEL = "haiku";

const NAMER_TITLE = "namer";

/**
 * A second pane that renames the workspace after reading the task, then closes itself. The main
 * agent could do it, but only after it has finished thinking about the task — which is exactly the
 * minutes during which the sidebar shows a slug of raw input.
 */
export async function startWorkspaceNamer(selector: string, prefix: string, brief: string): Promise<string> {
  const directory = mkdtempSync(join(tmpdir(), "orca-namer-"));
  const promptFile = join(directory, "prompt.txt");
  writeFileSync(promptFile, namerPrompt(prefix, brief), "utf8");

  return createTerminal(selector, namerCommand(selector, directory, promptFile), NAMER_TITLE);
}

export function namerPrompt(prefix: string, brief: string): string {
  return [
    "Ты придумываешь имя воркспейса в Orca и ничего больше.",
    `Ответь ОДНОЙ строкой вида "${prefix} :: <3-5 слов по-русски о сути задачи>".`,
    "Без кавычек, без пояснений, без точки в конце.",
    "",
    "Задача:",
    brief,
  ].join("\n");
}

/**
 * The brief goes through a file, never through the command line: it is arbitrary text with quotes
 * and newlines in it, and this string is handed to a shell.
 *
 * The workspace is addressed by its own selector rather than `current`, which Orca resolves through
 * the working directory — and every workspace of a folder project shares one directory, so `current`
 * there renames whichever one it finds first.
 */
export function namerCommand(selector: string, directory: string, promptFile: string): string {
  return [
    `name=$(claude -p --model ${NAMER_MODEL} < ${quote(promptFile)} | tr -d '\\r' | head -n 1 | cut -c1-120)`,
    `[ -n "$name" ] && orca worktree set --worktree ${quote(selector)} --display-name "$name" >/dev/null`,
    `rm -rf ${quote(directory)}`,
    `orca terminal close --terminal "$ORCA_TERMINAL_HANDLE" >/dev/null`,
  ].join("; ");
}

/** Single quotes with the usual escape: a workspace path may legitimately contain one. */
function quote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
