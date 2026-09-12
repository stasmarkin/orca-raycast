import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getPreferenceValues } from "@raycast/api";
import type { z } from "zod";
import { resolveOrcaBinary } from "./binary";

const run = promisify(execFile);

// `worktree ps` on a busy host is a few hundred KB; repo icons push `repo list` well past that.
const MAX_BUFFER = 32 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

type OrcaErrorBody = {
  code: string;
  message: string;
  data?: { suggestions?: string[]; nextSteps?: string[] };
};

const UNKNOWN_FAILURE: OrcaErrorBody = { code: "unknown", message: "Orca reported a failure without details" };

export class OrcaCommandError extends Error {
  readonly code: string;
  readonly nextSteps: string[];

  constructor(body: OrcaErrorBody) {
    super(body.message || body.code);
    this.name = "OrcaCommandError";
    this.code = body.code;
    this.nextSteps = body.data?.nextSteps ?? [];
  }
}

/** The CLI answered, but not in a shape this extension understands — almost always a version skew. */
export class OrcaContractError extends Error {
  constructor(command: string, detail: string) {
    super(`Orca CLI returned an unexpected payload for \`${command}\` (${detail}). Update Orca or the extension.`);
    this.name = "OrcaContractError";
  }
}

/** Set when the command was killed by the timeout, so callers can say "still running" instead of "failed". */
export class OrcaTimeoutError extends Error {
  constructor(command: string) {
    super(`\`orca ${command}\` did not finish in time; it may still be running in Orca.`);
    this.name = "OrcaTimeoutError";
  }
}

export type InvokeOptions = { timeoutMs?: number };

/**
 * Runs `orca <args> --json`, unwraps the response envelope and validates it.
 *
 * Option values are passed as `--flag=value`: a bare `--flag value` breaks as soon as the value
 * itself starts with `--`, which an agent message like `--help me` routinely does.
 */
export async function invokeOrca<S extends z.ZodType>(
  args: string[],
  schema: S,
  options: InvokeOptions = {},
): Promise<z.infer<S>> {
  const { environment } = getPreferenceValues<{ environment?: string }>();
  const scoped = environment?.trim() ? [...args, `--environment=${environment.trim()}`] : args;
  const command = args.filter((arg) => !arg.startsWith("-")).join(" ");

  let stdout: string;
  try {
    const result = await run(resolveOrcaBinary(), [...scoped, "--json"], {
      maxBuffer: MAX_BUFFER,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      encoding: "utf8",
    });
    stdout = result.stdout;
  } catch (error) {
    if ((error as { killed?: boolean }).killed) throw new OrcaTimeoutError(command);
    // A failed command still prints its JSON envelope on stdout and exits 1.
    const stdoutOnFailure = (error as { stdout?: string }).stdout;
    if (!stdoutOnFailure) throw error;
    stdout = stdoutOnFailure;
  }

  return parseResponse(stdout, schema, command);
}

export function parseResponse<S extends z.ZodType>(stdout: string, schema: S, command: string): z.infer<S> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new OrcaContractError(command, "response was not JSON");
  }

  if (typeof parsed !== "object" || parsed === null || !("ok" in parsed)) {
    throw new OrcaContractError(command, "response had no `ok` field");
  }

  const envelope = parsed as { ok: unknown; result?: unknown; error?: OrcaErrorBody };
  if (envelope.ok !== true) throw new OrcaCommandError(envelope.error ?? UNKNOWN_FAILURE);

  const validated = schema.safeParse(envelope.result);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    throw new OrcaContractError(command, `${issue?.path.join(".") || "result"}: ${issue?.message}`);
  }
  return validated.data;
}

/** Message for a toast: the CLI's own next steps are more useful than the raw error string. */
export function describeError(error: unknown): string {
  if (error instanceof OrcaCommandError) {
    return error.nextSteps.length > 0 ? `${error.message} — ${error.nextSteps[0]}` : error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
