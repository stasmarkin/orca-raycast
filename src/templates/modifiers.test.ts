import { describe, expect, it } from "vitest";
import { resolveModifiers } from "./modifiers";

describe("resolveModifiers", () => {
  it("uses the template's defaults when nothing was toggled", () => {
    expect(resolveModifiers({ defaultModifiers: ["pin"] })).toEqual(["pin"]);
    expect(resolveModifiers({})).toEqual([]);
  });

  it("lets a toggle switch a default off and a non-default on", () => {
    expect(resolveModifiers({ defaultModifiers: ["pin"] }, { pin: false })).toEqual([]);
    expect(resolveModifiers({ defaultModifiers: ["pin"] }, { huge: true })).toEqual(["pin", "huge"]);
  });

  it("starts Focus on for a template that sets activate, and lets a toggle switch it off", () => {
    expect(resolveModifiers({ activate: true })).toEqual(["focus"]);
    expect(resolveModifiers({ activate: true }, { focus: false })).toEqual([]);
    expect(resolveModifiers({ activate: false }, { focus: true })).toEqual(["focus"]);
  });

  it("keeps the declared modifier order, not the order they were toggled in", () => {
    expect(resolveModifiers({}, { huge: true, pin: true })).toEqual(["pin", "huge"]);
  });
});
