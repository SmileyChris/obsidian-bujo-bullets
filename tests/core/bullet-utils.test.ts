import { describe, it, expect } from "vitest";
import { applyBulletChange, hasEventStatus, isBulletText, updateBulletType } from "src/core/bullet-utils";

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

  it("swaps to the In-Progress character", () => {
    expect(updateBulletType("- [ ] task", { name: "In-Progress", character: "/" })).toBe("- [/] task");
  });

  it("round-trips In-Progress back to Incomplete", () => {
    expect(updateBulletType("- [/] task", { name: "Incomplete", character: " " })).toBe("- [ ] task");
  });

  it("swaps a multi-char dynamic event marker", () => {
    expect(updateBulletType("- [o>Thu] event", { name: "Complete", character: "x" })).toBe("- [x] event");
  });

  it("swaps an empty dynamic event marker", () => {
    expect(updateBulletType("- [o>] event", { name: "Complete", character: "x" })).toBe("- [x] event");
  });
});

describe("applyBulletChange", () => {
  const COMPLETE = { name: "Complete", character: "x" };
  const CANCELLED = { name: "Cancelled", character: "-" };
  const INCOMPLETE = { name: "Incomplete", character: " " };
  const MIGRATED = { name: "Migrated", character: ">" };

  it("on plain [o] event, picking Complete adds [x] suffix (keeps [o])", () => {
    expect(applyBulletChange("- [o] meeting", COMPLETE)).toBe("- [o] [x] meeting");
  });

  it("on plain [o] event, picking Cancelled adds [-] suffix (keeps [o])", () => {
    expect(applyBulletChange("- [o] meeting", CANCELLED)).toBe("- [o] [-] meeting");
  });

  it("preserves [>Thu] deferred suffix when adding [x]", () => {
    expect(applyBulletChange("- [o] [>Thu] meeting", COMPLETE)).toBe("- [o] [>Thu] [x] meeting");
  });

  it("replaces an existing [x] with [-] when switching states", () => {
    expect(applyBulletChange("- [o] [x] meeting", CANCELLED)).toBe("- [o] [-] meeting");
  });

  it("replaces an existing [-] with [x] when switching states", () => {
    expect(applyBulletChange("- [o] [-] meeting", COMPLETE)).toBe("- [o] [x] meeting");
  });

  it("preserves [>Thu] when switching status [x] → [-]", () => {
    expect(applyBulletChange("- [o] [>Thu] [x] meeting", CANCELLED)).toBe("- [o] [>Thu] [-] meeting");
  });

  it("on [o] event, picking Incomplete still rewrites the primary marker", () => {
    expect(applyBulletChange("- [o] meeting", INCOMPLETE)).toBe("- [ ] meeting");
  });

  it("on non-event lines, behaves identically to updateBulletType", () => {
    expect(applyBulletChange("- [ ] task", COMPLETE)).toBe("- [x] task");
    expect(applyBulletChange("- [x] task", INCOMPLETE)).toBe("- [ ] task");
  });

  const EVENT = { name: "Event", character: "o" };

  it("on [o] [x] event, picking Event clears the status (reverts to upcoming)", () => {
    expect(applyBulletChange("- [o] [x] meeting", EVENT)).toBe("- [o] meeting");
  });

  it("on [o] [-] event, picking Event clears the status", () => {
    expect(applyBulletChange("- [o] [-] meeting", EVENT)).toBe("- [o] meeting");
  });

  it("preserves the day suffix when clearing status", () => {
    expect(applyBulletChange("- [o] [>Thu] [x] meeting", EVENT)).toBe("- [o] [>Thu] meeting");
  });

  it("on a plain [o] event, picking Event is a no-op", () => {
    expect(applyBulletChange("- [o] meeting", EVENT)).toBe("- [o] meeting");
  });

  it("on [o] event, picking Migrated adds [>] suffix (keeps [o])", () => {
    expect(applyBulletChange("- [o] meeting", MIGRATED)).toBe("- [o] [>] meeting");
  });

  const SCHEDULED = { name: "Scheduled", character: "<" };

  it("on [o] event, picking Scheduled adds [<] suffix", () => {
    expect(applyBulletChange("- [o] meeting", SCHEDULED)).toBe("- [o] [<] meeting");
  });

  it("preserves [>Thu] when migrating", () => {
    expect(applyBulletChange("- [o] [>Thu] meeting", MIGRATED)).toBe("- [o] [>Thu] [>] meeting");
  });

  it("status and action are mutually exclusive (Migrate on done → just migrated)", () => {
    expect(applyBulletChange("- [o] [x] meeting", MIGRATED)).toBe("- [o] [>] meeting");
  });

  it("status and action are mutually exclusive (Complete on migrated → just done)", () => {
    expect(applyBulletChange("- [o] [>] meeting", COMPLETE)).toBe("- [o] [x] meeting");
  });

  it("Event on [o] [>] reverts to plain [o]", () => {
    expect(applyBulletChange("- [o] [>] meeting", EVENT)).toBe("- [o] meeting");
  });

  it("Event on [o] [>Thu] [<] preserves the day and drops the action", () => {
    expect(applyBulletChange("- [o] [>Thu] [<] meeting", EVENT)).toBe("- [o] [>Thu] meeting");
  });
});

describe("hasEventStatus", () => {
  it("returns true for [x] status", () => {
    expect(hasEventStatus("- [o] [x] meeting")).toBe(true);
  });

  it("returns true for [-] status", () => {
    expect(hasEventStatus("- [o] [-] meeting")).toBe(true);
  });

  it("returns true for [>] action (migrated)", () => {
    expect(hasEventStatus("- [o] [>] meeting")).toBe(true);
  });

  it("returns true for [<] action (scheduled)", () => {
    expect(hasEventStatus("- [o] [<] meeting")).toBe(true);
  });

  it("returns true with a day suffix preceding the state", () => {
    expect(hasEventStatus("- [o] [>Thu] [x] meeting")).toBe(true);
  });

  it("returns false on a plain [o] event", () => {
    expect(hasEventStatus("- [o] meeting")).toBe(false);
  });

  it("returns false on a deferred event with no state suffix", () => {
    expect(hasEventStatus("- [o] [>Thu] meeting")).toBe(false);
  });

  it("returns false on non-event tasks", () => {
    expect(hasEventStatus("- [ ] task")).toBe(false);
    expect(hasEventStatus("- [x] task")).toBe(false);
  });
});
