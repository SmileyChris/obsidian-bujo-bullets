import { describe, it, expect, beforeEach } from "vitest";
import { SUFFIX_TOKEN_RE, categorizeSuffix } from "src/core/dynamic-event-bullet";

/**
 * Replicates the postprocessor's overlay logic in isolation. This mirrors
 * `applyDeferredEventOverlay` in src/index.ts — kept in sync so the parsing
 * + DOM manipulation behavior is testable without the Obsidian Plugin shim.
 */
function applyDeferredEventOverlay(li: HTMLElement): void {
  const input =
    li.querySelector<HTMLInputElement>("input.task-list-item-checkbox") ??
    li.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) return;

  const text = firstTextNodeIn(li);
  if (!text || !text.nodeValue) return;

  let day: string | null = null;
  let status: "done" | "cancelled" | null = null;
  let action: "migrated" | "scheduled" | null = null;
  while (text.nodeValue.length > 0) {
    const m = text.nodeValue.match(SUFFIX_TOKEN_RE);
    if (!m) break;
    const cat = categorizeSuffix(m[1]);
    if (!cat) break;
    if (cat.kind === "day" && day === null) day = cat.value;
    else if (cat.kind === "status" && status === null) status = cat.value;
    else if (cat.kind === "action" && action === null) action = cat.value;
    else break;
    text.nodeValue = text.nodeValue.slice(m[0].length);
  }
  if (day === null && status === null && action === null) return;

  text.nodeValue = text.nodeValue.replace(/^\s/, "");
  if (day !== null) li.setAttribute("data-bujo-day", day);
  if (status !== null) li.setAttribute("data-bujo-status", status);
  if (action !== null) li.setAttribute("data-bujo-action", action);
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

describe("applyDeferredEventOverlay (day suffix)", () => {
  it("sets data-bujo-day from `[>Thu]`", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;Thu] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-day")).toBe("THU");
  });

  it("strips the day token from the task text", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;Thu] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    const taskText = Array.from(li.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.nodeValue)
      .join("");
    expect(taskText.trim()).toBe("meeting");
  });

  it("works for loose lists (content wrapped in <p>)", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><p><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;Mon] meeting</p></li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-day")).toBe("MON");
  });
});

describe("applyDeferredEventOverlay (status suffix)", () => {
  it("sets data-bujo-status='done' for `[x]`", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [x] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-status")).toBe("done");
  });

  it("sets data-bujo-status='cancelled' for `[-]`", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [-] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-status")).toBe("cancelled");
  });
});

describe("applyDeferredEventOverlay (action suffix)", () => {
  it("sets data-bujo-action='migrated' for `[>]`", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-action")).toBe("migrated");
    expect(li.hasAttribute("data-bujo-day")).toBe(false);
  });

  it("sets data-bujo-action='scheduled' for `[<]`", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&lt;] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-action")).toBe("scheduled");
  });
});

describe("applyDeferredEventOverlay (combinations, any order)", () => {
  it("`[>Thu] [x]`: day then done", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;Thu] [x] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-day")).toBe("THU");
    expect(li.getAttribute("data-bujo-status")).toBe("done");
  });

  it("`[x] [>Thu]`: done then day (order independent)", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [x] [&gt;Thu] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-day")).toBe("THU");
    expect(li.getAttribute("data-bujo-status")).toBe("done");
  });

  it("`[>] [>Thu]`: action + day on the same line", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [&gt;] [&gt;Thu] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.getAttribute("data-bujo-action")).toBe("migrated");
    expect(li.getAttribute("data-bujo-day")).toBe("THU");
  });
});

describe("applyDeferredEventOverlay (no suffixes)", () => {
  it("leaves the li untouched if the task text has no recognized suffix", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> regular event</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.hasAttribute("data-bujo-day")).toBe(false);
    expect(li.hasAttribute("data-bujo-status")).toBe(false);
    expect(li.hasAttribute("data-bujo-action")).toBe(false);
  });

  it("stops at the first unrecognized token (keeps user content intact)", () => {
    const li = makeLi(
      `<li class="task-list-item" data-task="o"><input class="task-list-item-checkbox" type="checkbox" data-task="o"> [foo] meeting</li>`,
    );
    applyDeferredEventOverlay(li);
    expect(li.hasAttribute("data-bujo-day")).toBe(false);
    const taskText = Array.from(li.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.nodeValue)
      .join("");
    expect(taskText.trim()).toBe("[foo] meeting");
  });
});
