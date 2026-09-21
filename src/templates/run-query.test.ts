import { describe, expect, it } from "vitest";
import { matchTemplates, parseRunQuery } from "./run-query";
import { parseModifiers } from "./modifiers";
import { resolveRepoSelector } from "./repo-selection";
import type { WorkspaceTemplate } from "./template-file";

function template(id: string, title = id): WorkspaceTemplate {
  return { id, title, namePattern: "{slug}" };
}

describe("parseRunQuery", () => {
  it("splits the template id from its input", () => {
    expect(parseRunQuery("pp STARTREK-789")).toEqual({ templateQuery: "pp", input: "STARTREK-789" });
  });

  it("keeps a multi-word input intact", () => {
    expect(parseRunQuery("pp fix the login redirect")).toEqual({
      templateQuery: "pp",
      input: "fix the login redirect",
    });
  });

  it("treats a lone word as the template with no input", () => {
    expect(parseRunQuery("pp")).toEqual({ templateQuery: "pp", input: "" });
  });

  it("tolerates stray whitespace", () => {
    expect(parseRunQuery("   pp    STARTREK-789   ")).toEqual({ templateQuery: "pp", input: "STARTREK-789" });
    expect(parseRunQuery("")).toEqual({ templateQuery: "", input: "" });
  });
});

describe("matchTemplates", () => {
  const templates = [template("pp", "Product path"), template("ppx", "Extended"), template("review", "Review a PR")];

  it("returns everything for an empty query", () => {
    expect(matchTemplates(templates, "")).toHaveLength(3);
  });

  it("prefers an exact id over a longer one that merely starts with it", () => {
    expect(matchTemplates(templates, "pp").map((t) => t.id)).toEqual(["pp"]);
  });

  it("falls back to substring matching on id and title", () => {
    expect(matchTemplates(templates, "ppx").map((t) => t.id)).toEqual(["ppx"]);
    expect(matchTemplates(templates, "review").map((t) => t.id)).toEqual(["review"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(matchTemplates(templates, "zzz")).toEqual([]);
  });
});

describe("resolveRepoSelector", () => {
  it("prefers the template's own repo", () => {
    expect(resolveRepoSelector("name:orca", "id:fallback")).toBe("name:orca");
  });

  it("falls back to the picked repo when the template names none", () => {
    expect(resolveRepoSelector(undefined, "id:fallback")).toBe("id:fallback");
  });

  it("stays undefined when neither is set, so Orca reports a missing selector", () => {
    expect(resolveRepoSelector(undefined, undefined)).toBeUndefined();
    expect(resolveRepoSelector(undefined, "")).toBeUndefined();
  });
});

describe("parseModifiers", () => {
  it("reads a comma list and ignores unknown names", () => {
    expect(parseModifiers("pin,huge")).toEqual(["pin", "huge"]);
    expect(parseModifiers("pin, nonsense")).toEqual(["pin"]);
    expect(parseModifiers("")).toEqual([]);
  });
});
