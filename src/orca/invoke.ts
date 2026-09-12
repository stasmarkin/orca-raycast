import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getPreferenceValues } from "@raycast/api";
import { resolveOrcaBinary } from "./binary";

const run = promisify(execFile);

// `worktree ps` on a busy host is a few hundred KB; repo icons push `repo list` well past that.
const MAX_BUFFER = 32 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

type Envelope<T> = { id: string; ok: true; result: T } | { id: string; ok: false; error: OrcaErrorBody };

type OrcaErrorBody = {
  code: string;
  message: string;
  data?: { suggestions?: string[]; nextSteps?: string[] };
};

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

export type InvokeOptions = { timeoutMs?: number };

/** Runs `orca <args> --json` and unwraps the response envelope. */
export async function invokeOrca<T>(args: string[], options: InvokeOptions = {}): Promise<T> {
  const { environment } = getPreferenceValues<{ environment?: string }>();
  const scoped = environment?.trim() ? [...args, "--environment", environment.trim()] : args;

  let stdout: string;
  try {
    const result = await run(resolveOrcaBinary(), [...scoped, "--json"], {
      maxBuffer: MAX_BUFFER,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      encoding: "utf8",
    });
    stdout = result.stdout;
  } catch (error) {
    // A failed command still prints its JSON envelope on stdout and exits 1.
    const stdoutOnFailure = (error as { stdout?: string }).stdout;
    if (!stdoutOnFailure) throw error;
    stdout = stdoutOnFailure;
  }

  const envelope = parseEnvelope<T>(stdout);
  if (!envelope.ok) throw new OrcaCommandError(envelope.error);
  return envelope.result;
}

function parseEnvelope<T>(stdout: string): Envelope<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`Orca returned non-JSON output: ${stdout.slice(0, 200)}`);
  }

  if (typeof parsed !== "object" || parsed === null || !("ok" in parsed)) {
    throw new Error("Orca returned an unexpected response shape");
  }
  return parsed as Envelope<T>;
}
