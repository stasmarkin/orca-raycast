import { writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { ensureTemplateFile, readTemplates, TemplateFileError, TEMPLATE_FILE } from "./template-file";
import { findTemplate } from "./launch-template";

describe("readTemplates", () => {
  beforeAll(async () => {
    await ensureTemplateFile();
  });

  it("creates a starter file that parses", async () => {
    const templates = await readTemplates();
    expect(templates.map((template) => template.id)).toEqual(["pp", "review"]);
    expect(templates[0]?.defaultModifiers).toEqual(["pin"]);
  });

  it("leaves an existing file untouched", async () => {
    writeFileSync(TEMPLATE_FILE, JSON.stringify({ templates: [{ id: "mine", title: "Mine", namePattern: "x" }] }));
    await ensureTemplateFile();
    expect((await readTemplates())[0]?.id).toBe("mine");
  });

  it("accepts every worktree mode a launch knows how to make, and no others", async () => {
    for (const mode of ["orca", "arc"]) {
      writeFileSync(
        TEMPLATE_FILE,
        JSON.stringify({ templates: [{ id: "a", title: "A", namePattern: "x", worktree: mode, project: "pp" }] }),
      );
      expect((await readTemplates())[0]?.worktree, mode).toBe(mode);
    }

    writeFileSync(
      TEMPLATE_FILE,
      JSON.stringify({ templates: [{ id: "a", title: "A", namePattern: "x", worktree: "somewhere" }] }),
    );
    await expect(readTemplates()).rejects.toThrow(TemplateFileError);
  });

  it("rejects duplicate ids", async () => {
    writeFileSync(
      TEMPLATE_FILE,
      JSON.stringify({
        templates: [
          { id: "a", title: "A", namePattern: "x" },
          { id: "a", title: "B", namePattern: "y" },
        ],
      }),
    );
    await expect(readTemplates()).rejects.toThrow(/duplicate/);
  });

  it("rejects malformed JSON and missing fields", async () => {
    writeFileSync(TEMPLATE_FILE, "{ not json");
    await expect(readTemplates()).rejects.toThrow(TemplateFileError);

    writeFileSync(TEMPLATE_FILE, JSON.stringify({ templates: [{ id: "a", title: "A" }] }));
    await expect(readTemplates()).rejects.toThrow(/namePattern/);
  });

  it("rejects an arc template without a project", async () => {
    writeFileSync(
      TEMPLATE_FILE,
      JSON.stringify({ templates: [{ id: "a", title: "A", namePattern: "x", worktree: "arc" }] }),
    );
    await expect(readTemplates()).rejects.toThrow(/project/);

    writeFileSync(
      TEMPLATE_FILE,
      JSON.stringify({ templates: [{ id: "a", title: "A", namePattern: "x", worktree: "arc", project: "pp" }] }),
    );
    expect((await readTemplates())[0]?.project).toBe("pp");
  });
});

describe("findTemplate", () => {
  const items = [
    { id: "one", title: "Shared" },
    { id: "two", title: "Shared" },
    { id: "three", title: "Unique" },
  ];

  it("prefers an exact id", () => {
    expect(findTemplate(items, "two").id).toBe("two");
  });

  it("matches a unique title case-insensitively", () => {
    expect(findTemplate(items, "unique").id).toBe("three");
  });

  it("refuses an ambiguous title instead of silently picking one", () => {
    expect(() => findTemplate(items, "Shared")).toThrow(/matches 2 entries/);
  });

  it("reports a miss", () => {
    expect(() => findTemplate(items, "nope")).toThrow(/No entry matches/);
  });
});
