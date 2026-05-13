import { describe, it, expect } from "vitest";
import { DAY_SUFFIX_RE } from "src/core/dynamic-event-bullet";

describe("DAY_SUFFIX_RE", () => {
  it("matches `[>]` (unspecified deferral)", () => {
    const m = "[>] task".match(DAY_SUFFIX_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBeUndefined();
  });

  it("matches `[>]` at end of line with no following content", () => {
    const m = "[>]".match(DAY_SUFFIX_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBeUndefined();
  });

  it("matches `[>Thu]` with a 3-letter day", () => {
    const m = "[>Thu] task".match(DAY_SUFFIX_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("Thu");
  });

  it("matches lowercase day", () => {
    const m = "[>thu] task".match(DAY_SUFFIX_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("thu");
  });

  it("matches with leading whitespace", () => {
    const m = "  [>Mon] task".match(DAY_SUFFIX_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("Mon");
  });

  it("rejects a longer word — must be exactly 3 letters", () => {
    expect("[>Thursday] task".match(DAY_SUFFIX_RE)).toBeNull();
  });

  it("rejects a shorter word", () => {
    expect("[>Th] task".match(DAY_SUFFIX_RE)).toBeNull();
  });

  it("rejects text that doesn't start with `[>`", () => {
    expect("regular task text".match(DAY_SUFFIX_RE)).toBeNull();
  });

  it("rejects bare `>` (no brackets)", () => {
    expect(">Thu task".match(DAY_SUFFIX_RE)).toBeNull();
  });
});
