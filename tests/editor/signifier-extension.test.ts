import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { signifierExtension } from "src/editor/signifier-extension";

function buildView(
  doc: string,
  signifiers:
    | { name: string; value: string }[]
    | (() => { name: string; value: string }[]),
) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const provider =
    typeof signifiers === "function" ? signifiers : () => signifiers;
  const state = EditorState.create({
    doc,
    extensions: [signifierExtension(provider)],
  });
  return new EditorView({ state, parent });
}

describe("signifierExtension", () => {
  it("decorates a leading signifier on a plain list item", () => {
    const view = buildView("- ! priority task", [{ name: "Priority", value: "!" }]);
    const marks = view.dom.querySelectorAll(".bujo-bullet-signifier");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("!");
    view.destroy();
  });

  it("decorates a leading signifier inside a checkbox list item", () => {
    const view = buildView("- [ ] ? follow up", [{ name: "Follow-up", value: "?" }]);
    const marks = view.dom.querySelectorAll(".bujo-bullet-signifier");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("?");
    view.destroy();
  });

  it("does not decorate when signifier is not at the start of content", () => {
    const view = buildView("- is this ? ok", [{ name: "Follow-up", value: "?" }]);
    expect(view.dom.querySelector(".bujo-bullet-signifier")).toBeNull();
    view.destroy();
  });

  it("does not decorate non-list lines", () => {
    const view = buildView("! just a plain line", [{ name: "Priority", value: "!" }]);
    expect(view.dom.querySelector(".bujo-bullet-signifier")).toBeNull();
    view.destroy();
  });

  it("updates decorations when settings change via the provider", () => {
    const sigs: { name: string; value: string }[] = [];
    const view = buildView("- ! priority", () => sigs);
    // No signifier set yet: no decoration
    expect(view.dom.querySelector(".bujo-bullet-signifier")).toBeNull();
    sigs.push({ name: "Priority", value: "!" });
    view.dispatch({ changes: { from: 0, to: 0, insert: "" } });
    expect(view.dom.querySelector(".bujo-bullet-signifier")).not.toBeNull();
    view.destroy();
  });
});
