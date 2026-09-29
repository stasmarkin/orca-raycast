import { describe, expect, it } from "vitest";
import { namerCommand, namerPrompt } from "./workspace-namer";

describe("namerPrompt", () => {
  it("asks for one line with the workflow prefix", () => {
    const prompt = namerPrompt("stq", "проверь экспорт");
    expect(prompt).toContain('"stq :: <3-5 слов');
    expect(prompt).toContain("проверь экспорт");
  });

  it("carries a brief that would break a command line", () => {
    const brief = `он сказал "готово"; rm -rf /\nи ушёл`;
    expect(namerPrompt("q", brief)).toContain(brief);
  });
});

describe("namerCommand", () => {
  const command = namerCommand("/tmp/orca-namer-x", "/tmp/orca-namer-x/prompt.txt");

  it("reads the brief from the file rather than the command line", () => {
    expect(command).toContain("< '/tmp/orca-namer-x/prompt.txt'");
    expect(command).toContain("--model haiku");
  });

  it("renames the workspace it runs in, and only when a name came back", () => {
    expect(command).toContain('[ -n "$name" ]');
    expect(command).toContain("orca worktree set --worktree current --display-name");
  });

  it("cleans up after itself and closes its own pane", () => {
    expect(command).toContain("rm -rf '/tmp/orca-namer-x'");
    expect(command).toContain('orca terminal close --terminal "$ORCA_TERMINAL_HANDLE"');
  });
});
