import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OrcaCommandError, OrcaContractError, parseResponse } from "./invoke";
import { WorkspaceListSchema } from "./types";

const schema = z.object({ value: z.string() });

describe("parseResponse", () => {
  it("unwraps a successful envelope", () => {
    expect(parseResponse('{"ok":true,"result":{"value":"x"}}', schema, "cmd")).toEqual({ value: "x" });
  });

  it("raises the CLI error for a failed envelope", () => {
    const call = () =>
      parseResponse('{"ok":false,"error":{"code":"selector_not_found","message":"nope"}}', schema, "cmd");
    expect(call).toThrow(OrcaCommandError);
    expect(call).toThrow("nope");
  });

  it("does not crash when a failed envelope carries no error body", () => {
    expect(() => parseResponse('{"ok":false}', schema, "cmd")).toThrow(OrcaCommandError);
  });

  it("reports non-JSON output as a contract error", () => {
    expect(() => parseResponse("command not found", schema, "cmd")).toThrow(OrcaContractError);
  });

  it("reports a missing result as a contract error rather than undefined", () => {
    expect(() => parseResponse('{"ok":true}', schema, "cmd")).toThrow(OrcaContractError);
  });
});

describe("WorkspaceListSchema", () => {
  it("defaults a workspace without agents instead of throwing", () => {
    const parsed = WorkspaceListSchema.parse({ worktrees: [{ worktreeId: "a" }] });
    expect(parsed.worktrees[0]?.agents).toEqual([]);
    expect(parsed.truncated).toBe(false);
  });

  it("keeps unknown agent states rather than rejecting the payload", () => {
    const parsed = WorkspaceListSchema.parse({
      worktrees: [{ worktreeId: "a", agents: [{ state: "brand-new-state" }] }],
    });
    expect(parsed.worktrees[0]?.agents[0]?.state).toBe("brand-new-state");
  });

  it("surfaces truncation flags", () => {
    const parsed = WorkspaceListSchema.parse({ worktrees: [], totalCount: 255, truncated: true });
    expect(parsed).toMatchObject({ totalCount: 255, truncated: true });
  });

  it("tolerates null where a string is expected", () => {
    const parsed = WorkspaceListSchema.parse({ worktrees: [{ worktreeId: "a", branch: null, displayName: null }] });
    expect(parsed.worktrees[0]).toMatchObject({ branch: "", displayName: "" });
  });

  it("keeps a waiting agent visible when a sibling agent record is malformed", () => {
    const parsed = WorkspaceListSchema.parse({
      worktrees: [{ worktreeId: "a", agents: [{ state: null }, { state: "waiting" }] }],
    });
    expect(parsed.worktrees[0]?.agents.map((agent) => agent.state)).toContain("waiting");
  });

  it("drops only the unparseable workspace, not the whole list", () => {
    const parsed = WorkspaceListSchema.parse({ worktrees: [{ noIdAtAll: true }, { worktreeId: "good" }] });
    expect(parsed.worktrees.map((workspace) => workspace.worktreeId)).toEqual(["good"]);
  });

  it("refuses a missing or renamed container instead of reporting an empty list", () => {
    expect(WorkspaceListSchema.safeParse({}).success).toBe(false);
    expect(WorkspaceListSchema.safeParse({ workspaces: [] }).success).toBe(false);
    expect(WorkspaceListSchema.safeParse({ worktrees: null }).success).toBe(false);
  });
});
