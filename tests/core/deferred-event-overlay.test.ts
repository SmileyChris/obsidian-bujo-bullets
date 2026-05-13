import { describe, it, expect, beforeEach } from "vitest";
import { DAY_SUFFIX_RE } from "src/core/dynamic-event-bullet";

/**
 * Replicates the postprocessor's overlay logic in isolation. This is the same
 * code path as `applyDeferredEventOverlay` in src/index.ts — kept in sync
 * here so the regex + DOM manipulation behavior is testable without bringing
 * in the Obsidian Plugin shim.
 */
function applyDeferredEventOverlay(li: HTMLElement): void {
  const input =
    li.querySelector<HTMLInputElement>("input.task-list-item-checkbox") ??
    li.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) return;

  const text = firstTextNodeIn(li);
  if (!text || !text.nodeValue) return;

  const m = text.nodeValue.match(DAY_SUFFIX_RE);
  if (!m) return;

  const day = (m[1] ?? "").toUpperCase();
  text.nodeValue = text.nodeValue.slice(m[0].length).replace(/^\s/, "");
  li.setAttribute("data-bujo-day", day);
}

function firstTextNodeIn(root: Node): Text | null {
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode() as Text | null;
  while (current) {
    if (current.nodeValue && /\S/.test(current.nodeValue)) {
      return current;
    }
    current = walker.nextNode() as Text | null;
  }
  return null;
}

function makeLi(html: string): HTMLLIElement {
  const ul = document.createElement("ul");
  ul.innerHTML = html;
  return ul.firstElementChild as HTMLLIElement;
}

describe("applyDeferredEventOverlay (tight list)", () => {
  let li: HTMLLIElement;

  beforeEach(() => {
    // Obsidian's typical tight task-list output.
    li = makeLi(
      `<li class="task-list-item" data-task="o" data-line="0"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;Thu] Coming up</li>`,
    );
  });

  it("sets data-bujo-day on the li", () => {
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-day")).toBe("THU");
  });

  it("strips the >Thu token from the task text", () => {
    applyDeferredEventOverlay(li);
    // Find the original text node (the one outside the overlay wrap).
    const taskText = Array.from(li.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.nodeValue)
      .join("");
    expect(taskText.trim()).toBe("Coming up");
  });

  it("keeps the input as a direct child of the li (no wrapping)", () => {
    applyDeferredEventOverlay(li);
    expect(li.querySelector(".bujo-day-wrap")).toBeNull();
    expect(li.querySelector(".bujo-day-text")).toBeNull();
    const input = li.querySelector("input");
    expect(input?.parentElement).toBe(li);
  });
});

describe("applyDeferredEventOverlay (bare `>` — unspecified day)", () => {
  it("sets data-bujo-day to the empty string", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;] Tomorrow?</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-day")).toBe("");
  });

  it("still strips the [>] token even with no day", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;] Tomorrow?</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.textContent?.trim()).toBe("Tomorrow?");
  });
});

describe("applyDeferredEventOverlay (loose list — content wrapped in <p>)", () => {
  it("still finds the text inside a <p> child", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><p><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;Mon] Coming up</p></li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-day")).toBe("MON");
  });
});

describe("applyDeferredEventOverlay (no day suffix)", () => {
  it("leaves the li untouched if the task text has no `>` prefix", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> regular event</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.hasAttribute("data-bujo-day")).toBe(false);
    expect(li.querySelector(".bujo-day-text")).toBeNull();
  });
});
