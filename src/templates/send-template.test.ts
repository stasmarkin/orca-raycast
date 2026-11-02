import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickSendTarget, sendTemplate, SendTargetError } from "./send-template";
import { TerminalSchema, WorkspaceSchema, type Terminal, type Workspace } from "../orca/types";
import { listTerminals, sendToTerminal } from "../orca/terminals";
import { listWorkspaces } from "../orca/workspaces";

vi.mock("../orca/workspaces", () => ({ listWorkspaces: vi.fn() }));
vi.mock("../orca/terminals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../orca/terminals")>()),
  listTerminals: vi.fn(),
  sendToTerminal: vi.fn(),
}));

const NAME = "LEVI // Coordinator";
const WORKTREE = "repo::/levi";

function workspace(agents: { paneKey: string; state?: string }[], extra: Record<string, unknown> = {}): Workspace {
  return WorkspaceSchema.parse({
    worktreeId: WORKTREE,
    path: "/levi",
    displayName: NAME,
    agents: agents.map((agent) => ({ state: "done", agentType: "claude", ...agent })),
    ...extra,
  });
}

function terminal(handle: string, fields: Record<string, unknown>): Terminal {
  return TerminalSchema.parse({
    handle,
    worktreePath: "/levi",
    connected: true,
    writable: true,
    agentIdentity: "claude",
    ...fields,
  });
}

describe("pickSendTarget", () => {
  it("finds the agent's pane through the tab and leaf Orca files it under", () => {
    const terminals = [
      terminal("other", { tabId: "t2", leafId: "l2" }),
      terminal("main", { tabId: "t1", leafId: "l1" }),
    ];
    expect(pickSendTarget([workspace([{ paneKey: "t1:l1" }])], terminals, NAME)).toBe("main");
  });

  it("finds an orphaned pane by its recorded key", () => {
    const orphan = terminal("orphan", { orphaned: true, recordedPaneKey: "t1:l1", tabId: "pty:x", leafId: "pty:x" });
    expect(pickSendTarget([workspace([{ paneKey: "t1:l1" }])], [orphan], NAME)).toBe("orphan");
  });

  it("refuses a tracked pane that no longer identifies as an agent, where Enter would run a shell command", () => {
    const shell = terminal("shell", { tabId: "t1", leafId: "l1", agentIdentity: null });
    expect(() => pickSendTarget([workspace([{ paneKey: "t1:l1" }])], [shell], NAME)).toThrow(/does not identify/);
  });

  it("ignores a pane that claims an agent Orca does not track", () => {
    const stray = terminal("stray", { tabId: "t9", leafId: "l9" });
    const main = terminal("main", { tabId: "t1", leafId: "l1" });
    expect(pickSendTarget([workspace([{ paneKey: "t1:l1" }])], [stray, main], NAME)).toBe("main");
  });

  it("ignores a pane with the same key in another workspace", () => {
    const elsewhere = terminal("elsewhere", { tabId: "t1", leafId: "l1", worktreePath: "/other" });
    const main = terminal("main", { tabId: "t1", leafId: "l1" });
    expect(pickSendTarget([workspace([{ paneKey: "t1:l1" }])], [elsewhere, main], NAME)).toBe("main");
  });

  it("prefers the pane in a tab when an orphan shares its key, in either order", () => {
    const orphan = terminal("orphan", { orphaned: true, recordedPaneKey: "t1:l1" });
    const visible = terminal("visible", { tabId: "t1", leafId: "l1" });
    const target = [workspace([{ paneKey: "t1:l1" }])];
    expect(pickSendTarget(target, [orphan, visible], NAME)).toBe("visible");
    expect(pickSendTarget(target, [visible, orphan], NAME)).toBe("visible");
  });

  it("prefers the agent in a tab over one in an orphaned pane", () => {
    const terminals = [
      terminal("orphan", { orphaned: true, recordedPaneKey: "t2:l2" }),
      terminal("visible", { tabId: "t1", leafId: "l1" }),
    ];
    const target = workspace([{ paneKey: "t2:l2" }, { paneKey: "t1:l1" }]);
    expect(pickSendTarget([target], terminals, NAME)).toBe("visible");
  });

  it("refuses to guess between two visible agents", () => {
    const terminals = [terminal("a", { tabId: "t1", leafId: "l1" }), terminal("b", { tabId: "t2", leafId: "l2" })];
    const target = workspace([{ paneKey: "t1:l1" }, { paneKey: "t2:l2" }]);
    expect(() => pickSendTarget([target], terminals, NAME)).toThrow(/2 agents/);
  });

  it("refuses while the agent waits on a question or a permission prompt, where Enter would pick an option", () => {
    const terminals = [terminal("main", { tabId: "t1", leafId: "l1" })];
    expect(() => pickSendTarget([workspace([{ paneKey: "t1:l1", state: "waiting" }])], terminals, NAME)).toThrow(
      /waiting for your answer/,
    );
    const permission = workspace([{ paneKey: "t1:l1", state: "working" }], { status: "permission" });
    expect(() => pickSendTarget([permission], terminals, NAME)).toThrow(/waiting for your answer/);
  });

  it("refuses a workspace with no live agent pane", () => {
    const disconnected = terminal("main", { tabId: "t1", leafId: "l1", connected: false });
    expect(() => pickSendTarget([workspace([{ paneKey: "t1:l1" }])], [disconnected], NAME)).toThrow(SendTargetError);
    expect(() => pickSendTarget([workspace([])], [], NAME)).toThrow(/No live agent/);
  });

  it("matches the name exactly and skips archived workspaces", () => {
    const terminals = [terminal("main", { tabId: "t1", leafId: "l1" })];
    const old = workspace([{ paneKey: "t1:l1" }], { displayName: "LEVI // old coordinator" });
    expect(() => pickSendTarget([old], terminals, NAME)).toThrow(/not open/);

    const archived = workspace([{ paneKey: "t1:l1" }], { isArchived: true });
    expect(() => pickSendTarget([archived], terminals, NAME)).toThrow(/not open/);
  });

  it("refuses when two open workspaces share the name", () => {
    const terminals = [terminal("main", { tabId: "t1", leafId: "l1" })];
    const twin = workspace([{ paneKey: "t1:l1" }]);
    expect(() => pickSendTarget([twin, twin], terminals, NAME)).toThrow(/2 workspaces/);
  });
});

describe("sendTemplate", () => {
  beforeEach(() => {
    vi.mocked(listWorkspaces).mockResolvedValue({
      worktrees: [workspace([{ paneKey: "t1:l1" }])],
      totalCount: 1,
      truncated: false,
    });
    vi.mocked(listTerminals).mockResolvedValue({
      terminals: [terminal("main", { tabId: "t1", leafId: "l1" })],
      totalCount: 1,
      truncated: false,
    });
    vi.mocked(sendToTerminal).mockReset();
  });

  it("sends the wrapped message as one submitted line", async () => {
    const template = { id: "@levi", title: "LEVI", send: NAME, prompt: "От Стаса:\n{input}" };
    await expect(sendTemplate(template, " проверь\n  демон ")).resolves.toEqual({ handle: "main" });
    expect(sendToTerminal).toHaveBeenCalledWith("main", "От Стаса: проверь демон", true);
  });

  it("sends nothing without a message", async () => {
    await expect(sendTemplate({ id: "@levi", title: "LEVI", send: NAME }, "  ")).rejects.toThrow(/Nothing to send/);
    await expect(sendTemplate({ id: "@levi", title: "LEVI", send: NAME, requiresInput: true }, "")).rejects.toThrow(
      /needs an input/,
    );
    expect(sendToTerminal).not.toHaveBeenCalled();
  });
});
