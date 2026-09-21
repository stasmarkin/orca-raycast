import { describe, expect, it } from "vitest";
import { toWtWorktreeName } from "./worktree-name";

describe("toWtWorktreeName", () => {
  it("keeps a ticket key exactly as typed", () => {
    expect(toWtWorktreeName("TRACKERCAT-123")).toBe("TRACKERCAT-123");
    expect(toWtWorktreeName("  STARTREK-1  ")).toBe("STARTREK-1");
  });

  it("transliterates a URL and a Russian brief into something wt accepts", () => {
    const name = toWtWorktreeName("https://tracker.yandex.ru/pages/x Можете тут указать разработчика");
    expect(name).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/);
    expect(name.startsWith("https-tracker-yandex-ru")).toBe(true);
  });

  it("steps aside from the names wt reserves for review slots", () => {
    expect(toWtWorktreeName("slot-1")).toBe("wt-slot-1");
    expect(toWtWorktreeName("Slot 1 review")).toBe("wt-slot-1-review");
  });

  it("falls back to a usable name when nothing survives transliteration", () => {
    expect(toWtWorktreeName("—— ??? ——")).toBe("task");
  });
});
