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
    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe("review");
  });

  it("leaves an existing file untouched", async () => {
    writeFileSync(TEMPLATE_FILE, JSON.stringify({ templates: [{ id: "mine", title: "Mine", namePattern: "x" }] }));
    await ensureTemplateFile();
    expect((await readTemplates())[0]?.id).toBe("mine");
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
