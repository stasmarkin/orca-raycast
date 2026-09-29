import { describe, expect, it } from "vitest";
import { namerCommand, namerPrompt } from "./workspace-namer";

const SELECTOR = "id:repo-1::/Users/me/arcadia/tracker/plugins-platform::workspace:abc";

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
  const command = namerCommand(SELECTOR, "/tmp/orca-namer-x", "/tmp/orca-namer-x/prompt.txt");

  it("reads the brief from the file rather than the command line", () => {
    expect(command).toContain("< '/tmp/orca-namer-x/prompt.txt'");
    expect(command).toContain("--model haiku");
  });

  it("renames the workspace it was told to, never the one the directory happens to match", () => {
    expect(command).toContain(`--worktree '${SELECTOR}'`);
    expect(command).not.toContain("--worktree current");
    expect(command).toContain('[ -n "$name" ]');
  });

  it("survives a quote in the path it was handed", () => {
    const quoted = namerCommand("id:repo::/Users/me/it's", "/tmp/d", "/tmp/d/p.txt");
    expect(quoted).toContain(`--worktree 'id:repo::/Users/me/it'\\''s'`);
  });

  it("cleans up after itself and closes its own pane", () => {
    expect(command).toContain("rm -rf '/tmp/orca-namer-x'");
    expect(command).toContain('orca terminal close --terminal "$ORCA_TERMINAL_HANDLE"');
  });
});
