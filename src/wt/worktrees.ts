import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { toolEnv } from "../tool-search-path";
import { resolveWtBinary } from "./binary";

const run = promisify(execFile);

// An arc checkout of the monorepo, plus the agent launch on top of it, is minutes of work.
const TIMEOUT_MS = 600_000;

// A toast shows one line; a wall of stderr in it helps nobody.
const MAX_MESSAGE_LENGTH = 300;

/**
 * `wt new --json` prints exactly one object. Unlike the Orca CLI there is no envelope: a non-zero
 * exit code is the failure signal and the reason is on stderr.
 */
const WtWorktreeSchema = z.object({
  worktreeId: z.string().min(1),
  repoId: z.string().catch(""),
  path: z.string().catch(""),
  name: z.string().catch(""),
  agentTerminalHandle: z.string().nullable().catch(null),
});

export type WtWorktree = z.infer<typeof WtWorktreeSchema>;

export class WtCommandError extends Error {
  constructor(message: string) {
    super(`wt: ${message}`);
    this.name = "WtCommandError";
  }
}

/** `wt` answered, but not in a shape this extension understands — almost always a version skew. */
export class WtContractError extends Error {
  constructor(detail: string) {
    super(`wt returned an unexpected payload (${detail}). Update wt or the extension.`);
    this.name = "WtContractError";
  }
}

/** Set when the command was killed by the timeout, so callers can say "still running" instead of "failed". */
export class WtTimeoutError extends Error {
  constructor() {
    super("`wt new` did not finish in time; the checkout may still be created in the background.");
    this.name = "WtTimeoutError";
  }
}

export type CreateArcWorktreeInput = {
  name: string;
  /** `wt` project id, e.g. `pp`. */
  project: string;
  agent?: string;
  prompt?: string;
};

/** Creates an arc worktree, registers it in Orca and starts the agent — all of it inside `wt`. */
export async function createArcWorktree(input: CreateArcWorktreeInput): Promise<WtWorktree> {
  // `--flag=value` for the same reason as in the Orca client: a prompt starting with `--` must not become a flag.
  const args = ["new", `--name=${input.name}`, `--project=${input.project}`];
  if (input.agent) args.push(`--agent=${input.agent}`);
  if (input.prompt) args.push(`--prompt=${input.prompt}`);
  args.push("--json");

  let stdout: string;
  try {
    const result = await run(resolveWtBinary(), args, { timeout: TIMEOUT_MS, encoding: "utf8", env: toolEnv() });
    stdout = result.stdout;
  } catch (error) {
    if ((error as { killed?: boolean }).killed) throw new WtTimeoutError();
    throw new WtCommandError(failureMessage(error));
  }

  return parseWtOutput(stdout);
}

export function parseWtOutput(stdout: string): WtWorktree {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new WtContractError("output was not JSON");
  }

  const validated = WtWorktreeSchema.safeParse(parsed);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    throw new WtContractError(`${issue?.path.join(".") || "result"}: ${issue?.message}`);
  }
  return validated.data;
}

function failureMessage(error: unknown): string {
  const stderr = (error as { stderr?: string }).stderr?.replace(/\s+/g, " ").trim();
  const message = stderr || (error as Error).message || "failed without any output";
  return message.length > MAX_MESSAGE_LENGTH ? `${message.slice(0, MAX_MESSAGE_LENGTH)}…` : message;
}
