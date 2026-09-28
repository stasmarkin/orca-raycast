import { describe, expect, it } from "vitest";
import { composeBrief } from "./launch-template";

describe("composeBrief", () => {
  it("puts the brief where the prefix asks for it", () => {
    expect(composeBrief("Ты оркестратор. Задача: {brief}", "STARTREK-1")).toBe("Ты оркестратор. Задача: STARTREK-1");
  });

  it("keeps a brief that looks like a replacement pattern", () => {
    expect(composeBrief("Задача: {brief}", "найди $& и $' в коде")).toBe("Задача: найди $& и $' в коде");
  });

  it("appends the brief when the prefix forgot the placeholder", () => {
    expect(composeBrief("Ты оркестратор.", "STARTREK-1")).toBe("Ты оркестратор. STARTREK-1");
  });

  it("collapses newlines, because one inside a TUI submits the message", () => {
    expect(composeBrief("Задача: {brief}", "первая строка\n  вторая строка")).toBe(
      "Задача: первая строка вторая строка",
    );
  });
});
