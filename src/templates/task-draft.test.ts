import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorage } from "@raycast/api";
import { clearTaskDraft, overridesFromDraft, readAllTaskDrafts, readTaskDraft, writeTaskDraft } from "./task-draft";

describe("task draft", () => {
  beforeEach(async () => {
    for (const key of Object.keys(await LocalStorage.allItems())) await LocalStorage.removeItem(key);
  });

  it("comes back with what was typed", async () => {
    await writeTaskDraft("stq", { input: "проверь релиз", modifiers: ["pin"], repo: "" });
    expect(await readTaskDraft("stq")).toEqual({ input: "проверь релиз", modifiers: ["pin"], repo: "" });
  });

  it("keeps one draft per workflow", async () => {
    await writeTaskDraft("stq", { input: "трекер", modifiers: [], repo: "" });
    await writeTaskDraft("ppq", { input: "платформа", modifiers: [], repo: "" });

    expect((await readTaskDraft("stq"))?.input).toBe("трекер");
    expect(Object.keys(await readAllTaskDrafts()).sort()).toEqual(["ppq", "stq"]);

    await clearTaskDraft("stq");
    expect(await readTaskDraft("stq")).toBeUndefined();
    expect((await readTaskDraft("ppq"))?.input).toBe("платформа");
  });

  it("ignores a draft with nothing typed in it", async () => {
    await writeTaskDraft("stq", { input: "   ", modifiers: [], repo: "" });
    expect(await readTaskDraft("stq")).toBeUndefined();
    expect(await readAllTaskDrafts()).toEqual({});
  });

  it("survives a payload it cannot read instead of throwing", async () => {
    await LocalStorage.setItem("taskDraft:stq", "{ not json");
    expect(await readTaskDraft("stq")).toBeUndefined();

    await LocalStorage.setItem("taskDraft:ppq", JSON.stringify({ input: "x", modifiers: ["nonsense"] }));
    expect(await readTaskDraft("ppq")).toMatchObject({ input: "x", modifiers: [], repo: "" });
  });

  it("does not mistake another extension key for a draft", async () => {
    await LocalStorage.setItem("defaultRepoSelector", "id:1");
    expect(await readAllTaskDrafts()).toEqual({});
  });

  it("turns the stored set back into explicit checkbox state", () => {
    expect(overridesFromDraft(["pin"])).toEqual({ pin: true, huge: false });
    expect(overridesFromDraft([])).toEqual({ pin: false, huge: false });
  });
});
