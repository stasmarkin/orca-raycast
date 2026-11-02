import { describe, expect, it, vi } from "vitest";
import { agentTerminal, canReceiveInput, sendToTerminal, terminalsForWorkspace } from "./terminals";
import { TerminalSchema } from "./types";
import { invokeOrca } from "./invoke";

vi.mock("./invoke", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./invoke")>()),
  invokeOrca: vi.fn(),
}));

function terminal(overrides: Record<string, unknown>) {
  return TerminalSchema.parse({ handle: "t", ...overrides });
}

describe("canReceiveInput", () => {
  it("accepts a connected writable agent pane", () => {
    expect(canReceiveInput(terminal({ agentIdentity: "claude", connected: true, writable: true }))).toBe(true);
  });

  it("rejects a plain shell, where the text would run as a command", () => {
    expect(canReceiveInput(terminal({ agentIdentity: null, connected: true, writable: true }))).toBe(false);
  });

  it("rejects disconnected or read-only panes", () => {
    expect(canReceiveInput(terminal({ agentIdentity: "claude", connected: false, writable: true }))).toBe(false);
    expect(canReceiveInput(terminal({ agentIdentity: "claude", connected: true, writable: false }))).toBe(false);
  });
});

describe("agentTerminal", () => {
  it("never falls back to the first pane", () => {
    const shell = terminal({ handle: "shell", agentIdentity: null, connected: true, writable: true });
    expect(agentTerminal([shell])).toBeUndefined();
  });

  it("picks the agent pane over an earlier shell", () => {
    const shell = terminal({ handle: "shell", agentIdentity: null, connected: true, writable: true });
    const agent = terminal({ handle: "agent", agentIdentity: "codex", connected: true, writable: true });
    expect(agentTerminal([shell, agent])?.handle).toBe("agent");
  });
});

describe("terminalsForWorkspace", () => {
  it("matches by path", () => {
    const a = terminal({ handle: "a", worktreePath: "/w/one" });
    const b = terminal({ handle: "b", worktreePath: "/w/two" });
    expect(terminalsForWorkspace([a, b], "/w/one").map((t) => t.handle)).toEqual(["a"]);
  });

  it("returns nothing for an empty path instead of claiming unrelated terminals", () => {
    const orphan = terminal({ handle: "a", worktreePath: "" });
    expect(terminalsForWorkspace([orphan], "")).toEqual([]);
  });
});

describe("sendToTerminal", () => {
  it("fails when Orca refuses the input, so the caller keeps the user's text", async () => {
    vi.mocked(invokeOrca).mockResolvedValueOnce({ send: { accepted: false, refusedReason: "busy" } });
    await expect(sendToTerminal("t", "hi", true)).rejects.toThrow(/refused the input: busy/);
  });

  it("succeeds on an accepted send and on an older host that reports no verdict", async () => {
    vi.mocked(invokeOrca)
      .mockResolvedValueOnce({ send: { accepted: true } })
      .mockResolvedValueOnce({});
    await expect(sendToTerminal("t", "hi", true)).resolves.toBeUndefined();
    await expect(sendToTerminal("t", "hi", true)).resolves.toBeUndefined();
  });
});
