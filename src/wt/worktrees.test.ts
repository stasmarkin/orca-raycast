import { describe, expect, it } from "vitest";
import { parseWtOutput, WtContractError } from "./worktrees";

describe("parseWtOutput", () => {
  it("reads the documented payload", () => {
    const parsed = parseWtOutput(
      JSON.stringify({
        worktreeId: "repo-1::/Users/me/arcadia/x",
        repoId: "repo-1",
        path: "/Users/me/arcadia/x",
        name: "STARTREK-1",
        agentTerminalHandle: "term_7",
      }),
    );
    expect(parsed).toMatchObject({ worktreeId: "repo-1::/Users/me/arcadia/x", agentTerminalHandle: "term_7" });
  });

  it("reads an undelivered brief, and assumes delivery when wt is too old to say", () => {
    const failed = parseWtOutput(
      JSON.stringify({ worktreeId: "repo-1::/x", promptSent: false, promptError: "агент не вышел в idle" }),
    );
    expect(failed).toMatchObject({ promptSent: false, promptError: "агент не вышел в idle" });
    expect(parseWtOutput(JSON.stringify({ worktreeId: "repo-1::/x" })).promptSent).toBe(true);
  });

  it("keeps the worktree when no agent was started", () => {
    const parsed = parseWtOutput(JSON.stringify({ worktreeId: "repo-1::/x", agentTerminalHandle: null }));
    expect(parsed.agentTerminalHandle).toBeNull();
  });

  it("refuses a payload without the id everything downstream is addressed by", () => {
    expect(() => parseWtOutput(JSON.stringify({ path: "/x" }))).toThrow(WtContractError);
    expect(() => parseWtOutput(JSON.stringify({ worktreeId: "" }))).toThrow(WtContractError);
  });

  it("reports non-JSON output as a contract error", () => {
    expect(() => parseWtOutput("wt: unknown project\n")).toThrow(WtContractError);
  });
});
