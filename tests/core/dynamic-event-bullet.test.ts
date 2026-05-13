import { describe, it, expect } from "vitest";
import { SUFFIX_TOKEN_RE, categorizeSuffix } from "src/core/dynamic-event-bullet";

describe("SUFFIX_TOKEN_RE", () => {
  it("matches a single token at the start of text", () => {
    const m = "[>Thu] foo".match(SUFFIX_TOKEN_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(">Thu");
  });

  it("matches with leading whitespace", () => {
    const m = "  [x] foo".match(SUFFIX_TOKEN_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("x");
  });

  it("matches at end of line with no following content", () => {
    const m = "[-]".match(SUFFIX_TOKEN_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("-");
  });

  it("rejects wikilinks (`[[...]]`)", () => {
    expect("[[Page]] foo".match(SUFFIX_TOKEN_RE)).toBeNull();
  });

  it("rejects empty brackets `[]`", () => {
    expect("[] foo".match(SUFFIX_TOKEN_RE)).toBeNull();
  });
});

describe("categorizeSuffix", () => {
  it("recognizes `>Thu` as day", () => {
    expect(categorizeSuffix(">Thu")).toEqual({ kind: "day", value: "THU" });
  });

  it("uppercases the day", () => {
    expect(categorizeSuffix(">mon")).toEqual({ kind: "day", value: "MON" });
  });

  it("recognizes `>` (no day) as migrated action", () => {
    expect(categorizeSuffix(">")).toEqual({ kind: "action", value: "migrated" });
  });

  it("recognizes `<` as scheduled action", () => {
    expect(categorizeSuffix("<")).toEqual({ kind: "action", value: "scheduled" });
  });

  it("recognizes `x` / `X` as done status", () => {
    expect(categorizeSuffix("x")).toEqual({ kind: "status", value: "done" });
    expect(categorizeSuffix("X")).toEqual({ kind: "status", value: "done" });
  });

  it("recognizes `-` as cancelled status", () => {
    expect(categorizeSuffix("-")).toEqual({ kind: "status", value: "cancelled" });
  });

  it("rejects unknown tokens", () => {
    expect(categorizeSuffix(">Thursday")).toBeNull();
    expect(categorizeSuffix(">Th")).toBeNull();
    expect(categorizeSuffix("foo")).toBeNull();
    expect(categorizeSuffix("/")).toBeNull();
    expect(categorizeSuffix(" ")).toBeNull();
  });
});
