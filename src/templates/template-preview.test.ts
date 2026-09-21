import { describe, expect, it } from "vitest";
import { previewTemplate } from "./template-preview";
import type { WorkspaceTemplate } from "./template-file";

const ARC: WorkspaceTemplate = {
  id: "pp",
  title: "Plugins platform",
  worktree: "arc",
  project: "pp",
  namePattern: "{input}",
  agent: "claude",
  prompt: "Задача {input}. Собери требования.",
  requiresInput: true,
};

describe("previewTemplate", () => {
  it("shows the prompt the agent would receive", () => {
    const preview = previewTemplate(ARC, "  TRACKERCAT-123  ", "");
    expect(preview.prompt).toBe("Задача TRACKERCAT-123. Собери требования.");
  });

  it("slugifies the arc name, because wt would refuse the raw input", () => {
    const preview = previewTemplate(ARC, "https://tracker.yandex.ru/pages/x укажи разработчика", "");
    expect(preview.worktreeName).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/);
  });

  it("leaves an Orca workspace name alone, spaces and all", () => {
    const orca = { ...ARC, worktree: undefined, project: undefined, repo: "name:orca", namePattern: "CR :: {input}" };
    expect(previewTemplate(orca, "PR 42", "").worktreeName).toBe("CR :: PR 42");
  });

  it("expands the clipboard it was handed instead of reading one", () => {
    const withClipboard = { ...ARC, prompt: "Review {clipboard}" };
    expect(previewTemplate(withClipboard, "", "https://pr/1").prompt).toBe("Review https://pr/1");
  });

  it("reports a missing prompt as missing, not as empty", () => {
    const silent = { ...ARC, prompt: undefined };
    expect(previewTemplate(silent, "x", "").prompt).toBeUndefined();
  });
});
