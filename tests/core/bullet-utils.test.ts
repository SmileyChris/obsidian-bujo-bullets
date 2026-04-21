import { describe, it, expect } from "vitest";
import { isBulletText, updateBulletType } from "src/core/bullet-utils";

describe("isBulletText", () => {
  it("recognizes a plain checkbox", () => {
    expect(isBulletText("- [ ] task")).toBe(true);
  });

  it("recognizes a typed checkbox", () => {
    expect(isBulletText("- [x] done")).toBe(true);
  });

  it("recognizes an indented checkbox", () => {
    expect(isBulletText("    - [>] migrated")).toBe(true);
  });

  it("rejects a plain bullet", () => {
    expect(isBulletText("- plain")).toBe(false);
  });

  it("rejects arbitrary text", () => {
    expect(isBulletText("hello")).toBe(false);
  });
});

describe("updateBulletType", () => {
  it("swaps the checkbox character", () => {
    expect(updateBulletType("- [ ] task", { name: "Complete", character: "x" })).toBe("- [x] task");
  });

  it("preserves leading indent", () => {
    expect(updateBulletType("    - [x] task", { name: "Scheduled", character: "<" })).toBe("    - [<] task");
  });

  it("throws on non-bullet input", () => {
    expect(() => updateBulletType("hello", { name: "Complete", character: "x" })).toThrow();
  });
});
