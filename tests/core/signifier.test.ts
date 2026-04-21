import { describe, it, expect, beforeEach } from "vitest";
import { wrapSignifiers } from "src/core/signifier";

const signifiers = [
  { name: "Priority", value: "!" },
  { name: "Follow-up", value: "?" },
];

function render(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("wrapSignifiers", () => {
  it("wraps a leading signifier on a plain list item", () => {
    const root = render("<ul><li>! priority task</li></ul>");
    wrapSignifiers(root, signifiers);
    const li = root.querySelector("li")!;
    expect(li.innerHTML.startsWith('<span class="bujo-bullet-signifier">!</span>')).toBe(true);
  });

  it("wraps a leading signifier on a task list item", () => {
    const root = render('<ul><li class="task-list-item"><input type="checkbox"> ? follow up</li></ul>');
    wrapSignifiers(root, signifiers);
    const spans = root.querySelectorAll(".bujo-bullet-signifier");
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe("?");
  });

  it("does not wrap twice when invoked once (regression for issue #3)", () => {
    const root = render("<ul><li>! priority</li></ul>");
    wrapSignifiers(root, signifiers);
    const nested = root.querySelectorAll(".bujo-bullet-signifier .bujo-bullet-signifier");
    expect(nested.length).toBe(0);
  });

  it("does not replace the signifier character when it appears later in the text", () => {
    const root = render("<ul><li>is this ? okay</li></ul>");
    wrapSignifiers(root, signifiers);
    expect(root.querySelector(".bujo-bullet-signifier")).toBeNull();
  });

  it("is idempotent on repeated calls", () => {
    const root = render("<ul><li>! priority</li></ul>");
    wrapSignifiers(root, signifiers);
    wrapSignifiers(root, signifiers);
    expect(root.querySelectorAll(".bujo-bullet-signifier").length).toBe(1);
  });

  it("ignores empty signifier values", () => {
    const root = render("<ul><li>hello</li></ul>");
    wrapSignifiers(root, [{ name: "empty", value: "" }]);
    expect(root.querySelector(".bujo-bullet-signifier")).toBeNull();
  });
});
