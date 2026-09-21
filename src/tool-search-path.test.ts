import { describe, expect, it } from "vitest";
import { toolSearchPath } from "./tool-search-path";

describe("toolSearchPath", () => {
  it("puts the tool dirs ahead of the PATH Raycast inherited", () => {
    const dirs = toolSearchPath("/usr/bin:/bin").split(":");
    expect(dirs[0]).toBe("/opt/homebrew/bin");
    expect(dirs).toContain("/usr/bin");
  });

  it("lists every dir once, keeping its first position", () => {
    const dirs = toolSearchPath("/usr/bin:/opt/homebrew/bin").split(":");
    expect(dirs.filter((dir) => dir === "/opt/homebrew/bin")).toHaveLength(1);
    expect(dirs.indexOf("/opt/homebrew/bin")).toBeLessThan(dirs.indexOf("/usr/bin"));
  });

  it("stands alone when Raycast passes no PATH at all", () => {
    const dirs = toolSearchPath("").split(":");
    expect(dirs).toContain("/opt/homebrew/bin");
    // `wt` shells out to readlink and dirname before it reaches node.
    expect(dirs).toEqual(expect.arrayContaining(["/usr/bin", "/bin", "/usr/sbin", "/sbin"]));
    expect(dirs).not.toContain("");
  });
});
