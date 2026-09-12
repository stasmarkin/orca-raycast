import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("keeps latin words readable", () => {
    expect(slugify("Fix Login Redirect")).toBe("fix-login-redirect");
  });

  it("transliterates cyrillic instead of dropping it", () => {
    expect(slugify("СТАРТРЕК-123 багфикс")).toBe("startrek-123-bagfiks");
    expect(slugify("Ёжик в тумане")).toBe("ezhik-v-tumane");
    expect(slugify("разъезд подъём")).toBe("razezd-podem");
  });

  it("strips accents", () => {
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
  });

  it("falls back when nothing usable survives", () => {
    expect(slugify("")).toBe("task");
    expect(slugify("---")).toBe("task");
    expect(slugify("日本語")).toBe("task");
  });

  it("truncates without leaving a trailing separator", () => {
    expect(slugify("a".repeat(60))).toBe("a".repeat(40));
    expect(slugify(`${"a".repeat(39)} tail`)).toBe("a".repeat(39));
  });
});
