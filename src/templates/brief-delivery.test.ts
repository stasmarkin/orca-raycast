import { beforeEach, describe, expect, it, vi } from "vitest";
import { launchTemplate } from "./launch-template";
import { agentTerminalHandle, briefLeftUndelivered, CreateWorkspaceSchema } from "../orca/types";
import { createWorkspace } from "../orca/workspaces";
import { createTerminal, sendToTerminal, terminalAcceptsInput, waitForTuiIdle } from "../orca/terminals";
import type { WorkspaceTemplate } from "./template-file";

vi.mock("../orca/workspaces", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../orca/workspaces")>()),
  createWorkspace: vi.fn(),
  pinWorkspace: vi.fn(),
}));
vi.mock("../orca/terminals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../orca/terminals")>()),
  createTerminal: vi.fn(),
  sendToTerminal: vi.fn(),
  terminalAcceptsInput: vi.fn(),
  waitForTuiIdle: vi.fn(),
}));

const launchedWith = (promptOutcome: string, kind = "terminal") =>
  CreateWorkspaceSchema.parse({
    worktree: { id: "w1" },
    launch: { outcome: { kind, handle: "term_1" }, prompt: { delivery: "submit", outcome: promptOutcome } },
  });

describe("briefLeftUndelivered", () => {
  it("takes the brief back when Orca gave up delivering it", () => {
    expect(briefLeftUndelivered(launchedWith("not-delivered"))).toBe(true);
  });

  it.each(["handed-to-terminal", "unconfirmed", "journaled"])("never resends a brief that is %s", (outcome) => {
    expect(briefLeftUndelivered(launchedWith(outcome))).toBe(false);
  });

  it("leaves a structured chat alone, since it has no terminal to type into", () => {
    expect(briefLeftUndelivered(launchedWith("not-delivered", "structured"))).toBe(false);
  });

  it("leaves hosts without a launch receipt alone", () => {
    expect(briefLeftUndelivered(CreateWorkspaceSchema.parse({ agentTerminalHandle: "term_1" }))).toBe(false);
  });
});

describe("CreateWorkspaceSchema launch receipt", () => {
  it.each([null, { outcome: null, prompt: null }, { prompt: { delivery: "none" } }, { outcome: "odd" }])(
    "does not fail an already created workspace over a receipt like %j",
    (launch) => {
      expect(CreateWorkspaceSchema.safeParse({ worktree: { id: "w1" }, launch }).success).toBe(true);
    },
  );
});

describe("agentTerminalHandle", () => {
  it("prefers the receipt's agent pane over the startup terminal", () => {
    const result = CreateWorkspaceSchema.parse({
      startupTerminal: { handle: "term_setup" },
      launch: { outcome: { kind: "terminal", handle: "term_agent" } },
    });
    expect(agentTerminalHandle(result)).toBe("term_agent");
  });

  it("never offers a structured session handle as a terminal", () => {
    expect(agentTerminalHandle(launchedWith("journaled", "structured"))).toBeUndefined();
  });
});

describe("launchTemplate brief delivery", () => {
  const template: WorkspaceTemplate = {
    id: "q",
    title: "Question",
    namePattern: "q-test",
    agent: "claude",
    prompt: "Ответь по существу.\nВопрос: {input}",
  };

  beforeEach(() => {
    vi.mocked(createWorkspace).mockReset();
    vi.mocked(sendToTerminal).mockReset();
    vi.mocked(waitForTuiIdle).mockReset().mockResolvedValue(true);
    vi.mocked(terminalAcceptsInput).mockReset().mockResolvedValue(true);
  });

  it("types an undelivered brief into the agent pane exactly once", async () => {
    vi.mocked(createWorkspace).mockResolvedValue(launchedWith("not-delivered"));

    const outcome = await launchTemplate(template, "почему?");

    expect(sendToTerminal).toHaveBeenCalledTimes(1);
    expect(sendToTerminal).toHaveBeenCalledWith("term_1", "Ответь по существу. Вопрос: почему?", true);
    expect(outcome.warnings).toEqual([]);
  });

  it("leaves a brief Orca already handed over untouched", async () => {
    vi.mocked(createWorkspace).mockResolvedValue(launchedWith("handed-to-terminal"));

    await launchTemplate(template, "почему?");

    expect(sendToTerminal).not.toHaveBeenCalled();
  });

  it("warns instead of typing when the pane never became an agent", async () => {
    vi.mocked(createWorkspace).mockResolvedValue(launchedWith("not-delivered"));
    vi.mocked(waitForTuiIdle).mockResolvedValue(false);

    const outcome = await launchTemplate(template, "почему?");

    expect(sendToTerminal).not.toHaveBeenCalled();
    expect(outcome.warnings).toEqual(["Brief not typed: it never reached idle — send it by hand"]);
  });

  it("does not retype the brief of a huge launch, whose orchestrator gets it instead", async () => {
    vi.mocked(createWorkspace).mockResolvedValue(launchedWith("not-delivered"));
    vi.mocked(createTerminal).mockResolvedValue("term_orchestrator");

    await launchTemplate(template, "почему?", { modifiers: ["huge"] });

    expect(sendToTerminal).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendToTerminal).mock.calls[0]?.[0]).toBe("term_orchestrator");
  });
});
