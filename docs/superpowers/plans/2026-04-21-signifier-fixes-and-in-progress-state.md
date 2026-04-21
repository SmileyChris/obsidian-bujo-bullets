# Signifier Rendering Fixes + In-Progress State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs in the signifier post-processor (upstream issues #3, PR #4) and add the `- [/]` In-Progress bullet as a first-class BuJo type (upstream issue #6).

**Architecture:** Add a minimal vitest + jsdom test harness (no runner exists today) and refactor the inline post-processor in `src/index.ts` into pure helpers that can be unit-tested. Fix the duplicated-iteration bug (`.task-list-item` is a subset of `ul > li`). Extend the signifier coloring to Live Preview with a small CodeMirror 6 `ViewPlugin` + `Decoration.mark`. Add the `/` bullet type to `AVAILABLE_BULLETS_TYPES` — command-handler and context-menu loops pick it up automatically; render style copied from Obsidian Minimal.

**Tech Stack:** TypeScript 4.7, Obsidian Plugin API, esbuild 0.17, CodeMirror 6 (`@codemirror/view`, `@codemirror/state`), isomorphic-dompurify. New: vitest 1.x + jsdom.

**Out of scope:** Issue #5 (right-click menu missing — needs repro spike); README known-issues (copy/undo); changes to `manifest.json` id/author (fork branding is a later decision).

---

## File Structure

- **Create** `src/core/signifier.ts` — pure function `wrapSignifiers(container: HTMLElement, signifiers: Signifier[]): void`. Extracted from `src/index.ts:43-58`. Unit-testable.
- **Create** `src/core/bullet-types.ts` — single source of truth for `Bullet` type and `AVAILABLE_BULLETS_TYPES` array. Imported by `src/index.ts`, `src/handlers/command-handler.ts`, `src/core/bullet-utils.ts`. Avoids circular `import from "src"` style.
- **Create** `src/editor/signifier-extension.ts` — CodeMirror 6 `ViewPlugin` that scans visible ranges for signifier prefixes and applies `Decoration.mark({ class: "bujo-bullet-signifier" })`.
- **Create** `tests/core/signifier.test.ts`, `tests/core/bullet-utils.test.ts`, `tests/editor/signifier-extension.test.ts`.
- **Create** `vitest.config.ts` — configure jsdom env and module aliases matching `tsconfig.json`.
- **Modify** `src/index.ts` — import `AVAILABLE_BULLETS_TYPES` from new location, call `wrapSignifiers` helper, fix selector overlap, register editor extension.
- **Modify** `src/core/bullet-utils.ts` — import `Bullet` from `./bullet-types` instead of `src`.
- **Modify** `src/handlers/command-handler.ts` — import from `../core/bullet-types` instead of `src`.
- **Modify** `styles.css` — add `[data-task="/"]` block, constrain `.bujo-bullet-signifier` to reading view scope (live preview uses same class via CM decoration so no change needed there).
- **Modify** `package.json` — add `test` script, add vitest + jsdom devDependencies.
- **Modify** `CHANGELOG.md` — document bugfixes + new state under a new version header.

---

## Task 0: Add vitest + jsdom test harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `.eslintignore`

- [ ] **Step 1: Install vitest, jsdom, and types**

Run:
```bash
npm install --save-dev vitest@^1.6.0 jsdom@^24.0.0 @types/jsdom@^21.1.6
```

Expected: no errors; `package.json` gains three `devDependencies` entries and `package-lock.json` updates.

- [ ] **Step 2: Add test script**

Modify `package.json`. Inside `"scripts"`, add a `test` entry so the block reads:

```json
"scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "test": "vitest run",
    "test:watch": "vitest",
    "version": "node version-bump.mjs && git add manifest.json versions.json"
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, "./src"),
      obsidian: path.resolve(__dirname, "./tests/mocks/obsidian.ts"),
    },
  },
});
```

- [ ] **Step 4: Write the obsidian module mock**

Create `tests/mocks/obsidian.ts`:

```ts
export class Plugin {}
export class PluginSettingTab {}
export class Setting {
  constructor(public containerEl: HTMLElement) {}
  setName() { return this; }
  setDesc() { return this; }
  setHeading() { return this; }
  addText() { return this; }
  addButton() { return this; }
  addExtraButton() { return this; }
  get infoEl() { return document.createElement("div"); }
}
export class Menu {
  addItem() { return this; }
  showAtPosition() {}
}
export type App = unknown;
export type Editor = unknown;
export type MarkdownView = unknown;
```

Only surface-level enough for type resolution. Real tests target pure helpers, not the plugin class.

- [ ] **Step 5: Ignore tests in eslint**

Modify `.eslintignore`. Before:

```
main.js
```

After:

```
main.js
tests/
vitest.config.ts
```

- [ ] **Step 6: Sanity-check vitest runs**

Create `tests/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs vitest under jsdom", () => {
    const el = document.createElement("div");
    el.innerHTML = "<span>ok</span>";
    expect(el.textContent).toBe("ok");
  });
});
```

Run:

```bash
npm test
```

Expected: `1 passed`.

- [ ] **Step 7: Delete sanity test**

```bash
rm tests/sanity.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/mocks/obsidian.ts .eslintignore
git commit -m "chore: add vitest + jsdom test harness"
```

---

## Task 1: Extract bullet types into dedicated module

**Files:**
- Create: `src/core/bullet-types.ts`
- Modify: `src/index.ts`
- Modify: `src/core/bullet-utils.ts`
- Modify: `src/handlers/command-handler.ts`

Rationale: `src/core/bullet-utils.ts` and `src/handlers/command-handler.ts` both `import { Bullet } from "src"` / `from "src"`, which creates a circular dependency against the plugin entrypoint. Moving the type and list to their own module removes the cycle and lets tests import them without loading the Obsidian `Plugin` class.

- [ ] **Step 1: Create `src/core/bullet-types.ts`**

```ts
export type Bullet = {
  name: string;
  character: string;
};

export const AVAILABLE_BULLETS_TYPES: Bullet[] = [
  { name: "Incomplete", character: " " },
  { name: "Complete", character: "x" },
  { name: "Irrelevant", character: "-" },
  { name: "Migrated", character: ">" },
  { name: "Scheduled", character: "<" },
  { name: "Event", character: "o" },
];
```

- [ ] **Step 2: Update `src/core/bullet-utils.ts` import**

Replace line 1 (`import { Bullet } from "src"`) with:

```ts
import { Bullet } from "./bullet-types";
```

Full file after edit:

```ts
import { Bullet } from "./bullet-types";

export function updateBulletType(original: string, newType: Bullet): string {
  if (!isBulletText(original)) {
    throw new Error("The provided text is not a valid bullet point.");
  }

  return original.replace(/- \[.\]/, `- [${newType.character}]`);
}

export function isBulletText(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("- [");
}
```

- [ ] **Step 3: Update `src/handlers/command-handler.ts` imports**

Replace lines 1-2 with:

```ts
import BuJoPlugin from "src";
import { AVAILABLE_BULLETS_TYPES } from "../core/bullet-types";
import { isBulletText, updateBulletType } from "../core/bullet-utils";
```

- [ ] **Step 4: Update `src/index.ts` to re-export from new module**

In `src/index.ts`, replace lines 11-23 (the `Bullet` type export + `AVAILABLE_BULLETS_TYPES` const) with:

```ts
export { AVAILABLE_BULLETS_TYPES } from "./core/bullet-types";
export type { Bullet } from "./core/bullet-types";
```

Also add at the top of the imports section so the file still uses the list:

```ts
import { AVAILABLE_BULLETS_TYPES } from "./core/bullet-types";
```

- [ ] **Step 5: Typecheck**

Run:

```bash
npx tsc -noEmit -skipLibCheck
```

Expected: no errors.

- [ ] **Step 6: Bundle check**

Run:

```bash
npm run build
```

Expected: build succeeds, `main.js` updates.

- [ ] **Step 7: Commit**

```bash
git add src/core/bullet-types.ts src/core/bullet-utils.ts src/handlers/command-handler.ts src/index.ts
git commit -m "refactor: move Bullet type and list to dedicated module"
```

---

## Task 2: Unit-test existing `bullet-utils` helpers

**Files:**
- Create: `tests/core/bullet-utils.test.ts`

- [ ] **Step 1: Write the test file**

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail where they should, pass where they should**

Run:

```bash
npm test
```

Expected: all 8 tests pass (these exercise code that already works). If any fail, the refactor in Task 1 broke something — fix before proceeding.

- [ ] **Step 3: Commit**

```bash
git add tests/core/bullet-utils.test.ts
git commit -m "test: cover isBulletText and updateBulletType"
```

---

## Task 3: Fix signifier double-wrap and selector overlap (issue #3, PR #4)

**Files:**
- Create: `src/core/signifier.ts`
- Create: `tests/core/signifier.test.ts`
- Modify: `src/index.ts:33-58`

Root cause: `element.findAll("ul > li")` and `element.findAll(".task-list-item")` both match the same `<li>` elements for tasks, so the concat `[...renderedNotes, ...renderedCheckboxes]` produces duplicates. The signifier wrap then runs twice, producing `<span class="bujo-bullet-signifier"><span class="bujo-bullet-signifier">?</span></span>`. Additionally, `bullet.innerHTML = bullet.innerHTML.replace(signifierText, ...)` wraps the first occurrence of the signifier character anywhere in the HTML — not just at the start — which can corrupt content (e.g. `?` inside an inline link).

Fix: query `ul > li` once, apply wrap using a text-node walk that only replaces the signifier when it is the literal first printable text of the list item.

- [ ] **Step 1: Write failing signifier tests**

Create `tests/core/signifier.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/core/signifier.test.ts
```

Expected: all 6 tests FAIL with "Cannot find module src/core/signifier" or equivalent.

- [ ] **Step 3: Implement `wrapSignifiers`**

Create `src/core/signifier.ts`:

```ts
export interface Signifier {
  name: string;
  value: string;
}

const SIGNIFIER_CLASS = "bujo-bullet-signifier";

export function wrapSignifiers(container: HTMLElement, signifiers: Signifier[]): void {
  const items = container.querySelectorAll<HTMLElement>("ul > li");
  for (const item of items) {
    applyToItem(item, signifiers);
  }
}

function applyToItem(item: HTMLElement, signifiers: Signifier[]): void {
  const textNode = firstMeaningfulTextNode(item);
  if (!textNode || !textNode.nodeValue) {
    return;
  }

  const leading = textNode.nodeValue.replace(/^\s+/, "");
  const trimLength = textNode.nodeValue.length - leading.length;

  for (const sig of signifiers) {
    if (!sig.value) continue;
    if (!leading.startsWith(sig.value + " ")) continue;

    const prefix = textNode.nodeValue.slice(0, trimLength);
    const rest = leading.slice(sig.value.length);

    const span = item.ownerDocument.createElement("span");
    span.className = SIGNIFIER_CLASS;
    span.textContent = sig.value;

    const before = item.ownerDocument.createTextNode(prefix);
    const after = item.ownerDocument.createTextNode(rest);

    const parent = textNode.parentNode!;
    parent.insertBefore(before, textNode);
    parent.insertBefore(span, textNode);
    parent.insertBefore(after, textNode);
    parent.removeChild(textNode);
    return;
  }
}

function firstMeaningfulTextNode(root: Node): Text | null {
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode() as Text | null;
  while (current) {
    if (current.nodeValue && current.nodeValue.trim().length > 0) {
      return current;
    }
    current = walker.nextNode() as Text | null;
  }
  return null;
}
```

Design notes (for reviewer — do not keep as code comments):
- Walking to the first non-empty text node skips over the `<input type="checkbox">` in task items and lands on the signifier text.
- Building a `span` via `createElement` avoids the `innerHTML.replace` bug (which matched anywhere in the string) and removes the need for DOMPurify in this path — the signifier value is set via `textContent`, so injection is impossible.
- Returning after the first matched signifier makes the function idempotent: a second pass sees the text node already split and finds no remaining leading `<sig> ` text.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- tests/core/signifier.test.ts
```

Expected: all 6 pass.

- [ ] **Step 5: Rewrite the post-processor in `src/index.ts`**

Modify `src/index.ts` lines 33-58. Before:

```ts
    this.registerMarkdownPostProcessor((element, _context) => {
      const renderedNotes = element.findAll('ul > li')
      const renderedCheckboxes = element.findAll('.task-list-item')
      const renderedBullets = [...renderedNotes, ...renderedCheckboxes]

      if (renderedBullets.length === 0) {
        return
      }

      // Process signifiers
      for (let bullet of renderedBullets) {
        const bulletText = bullet.innerText
        const signifiers = this.settings.signifiers;
        
        for (let signifier of signifiers) {
          const signifierText = signifier.value;

          if (bulletText.startsWith(signifierText + ' ')) {
            let html = bullet.innerHTML;
            let sanitizedText = DOMPurify.sanitize(signifierText);
            
            html = html.replace(signifierText, `<span class="bujo-bullet-signifier">${sanitizedText}</span>`);
            bullet.innerHTML = html
          }
        }
      }

      // Process checkboxes
      if (renderedCheckboxes.length === 0) {
        return
      }
```

After:

```ts
    this.registerMarkdownPostProcessor((element, _context) => {
      wrapSignifiers(element, this.settings.signifiers);

      const renderedCheckboxes = element.findAll(".task-list-item");
      if (renderedCheckboxes.length === 0) {
        return;
      }
```

Add the import at the top of `src/index.ts`:

```ts
import { wrapSignifiers } from "./core/signifier";
```

Remove the now-unused `DOMPurify` import — signifier injection is prevented by `textContent` assignment in `wrapSignifiers`. Delete the line:

```ts
import * as DOMPurify from 'isomorphic-dompurify';
```

- [ ] **Step 6: Uninstall the now-unused dompurify dep**

Run:

```bash
npm uninstall isomorphic-dompurify
```

Expected: `dependencies` in `package.json` is now empty or missing; `package-lock.json` updates.

- [ ] **Step 7: Typecheck + build**

Run:

```bash
npm run build
```

Expected: success.

- [ ] **Step 8: Run all tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/core/signifier.ts tests/core/signifier.test.ts src/index.ts package.json package-lock.json
git commit -m "fix: prevent signifier double-wrap and selector overlap (#3)"
```

---

## Task 4: Add `[/]` In-Progress bullet type (issue #6)

**Files:**
- Modify: `src/core/bullet-types.ts`
- Modify: `styles.css`
- Modify: `tests/core/bullet-utils.test.ts` (add coverage for new type)

The existing command loop in `src/handlers/command-handler.ts` iterates `AVAILABLE_BULLETS_TYPES`, so a new entry automatically becomes a new command `change-bullet-to-/`. The context-menu in `src/index.ts` also iterates the same array. No handler changes needed — just the list and the CSS.

- [ ] **Step 1: Add the In-Progress entry**

Modify `src/core/bullet-types.ts`:

```ts
export const AVAILABLE_BULLETS_TYPES: Bullet[] = [
  { name: "Incomplete", character: " " },
  { name: "In-Progress", character: "/" },
  { name: "Complete", character: "x" },
  { name: "Irrelevant", character: "-" },
  { name: "Migrated", character: ">" },
  { name: "Scheduled", character: "<" },
  { name: "Event", character: "o" },
];
```

- [ ] **Step 2: Add a unit test covering In-Progress**

Append to `tests/core/bullet-utils.test.ts` inside the `describe("updateBulletType", ...)` block:

```ts
  it("swaps to the In-Progress character", () => {
    expect(updateBulletType("- [ ] task", { name: "In-Progress", character: "/" })).toBe("- [/] task");
  });

  it("round-trips In-Progress back to Incomplete", () => {
    expect(updateBulletType("- [/] task", { name: "Incomplete", character: " " })).toBe("- [ ] task");
  });
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm test
```

Expected: all tests pass (10 total in bullet-utils).

- [ ] **Step 4: Add CSS for `[/]` render**

Modify `styles.css`. First, append `"/"` to each of the three shared selector lists at the top of the file. Before:

```css
input[data-task="-"],
input[data-task=">"],
input[data-task="<"],
input[data-task="o"],
li[data-task="-"] > input,
li[data-task=">"] > input,
li[data-task="<"] > input,
li[data-task="o"] > input,
li[data-task="-"] > p > input,
li[data-task=">"] > p > input,
li[data-task="<"] > p > input,
li[data-task="o"] > p > input {
```

After:

```css
input[data-task="-"],
input[data-task=">"],
input[data-task="<"],
input[data-task="o"],
input[data-task="/"],
li[data-task="-"] > input,
li[data-task=">"] > input,
li[data-task="<"] > input,
li[data-task="o"] > input,
li[data-task="/"] > input,
li[data-task="-"] > p > input,
li[data-task=">"] > p > input,
li[data-task="<"] > p > input,
li[data-task="o"] > p > input,
li[data-task="/"] > p > input {
```

Then, immediately before the final `.bujo-bullet-signifier` rule, append the In-Progress block (adapted from Obsidian Minimal `src/scss/features/checklist-icons.scss`, lines 107-127):

```css
/* [/] In-Progress Task */
input[data-task="/"],
li[data-task="/"] > input,
li[data-task="/"] > p > input {
  &:checked {
    background-image: none;
    background-color: transparent;
    position: relative;
    overflow: hidden;
    &::after {
      top: 0;
      left: 0;
      content: " ";
      display: block;
      position: absolute;
      background-color: var(--background-modifier-accent);
      width: calc(50% - 0.5px);
      height: 100%;
      -webkit-mask-image: none;
    }
  }
}
```

- [ ] **Step 5: Manual-verify in Obsidian sandbox vault**

There is no automated path to exercise rendered Obsidian output. Do this by hand:

1. Run `npm run dev` in one terminal (watch mode regenerates `main.js`).
2. Copy `main.js`, `manifest.json`, `styles.css` into an Obsidian sandbox vault's `.obsidian/plugins/bujo-bullets/` directory.
3. Enable the plugin, open a note containing:

   ```markdown
   - [ ] todo
   - [/] doing
   - [x] done
   - [-] no
   - [>] later
   - [<] scheduled
   - [o] event
   ```

4. In Reading mode: confirm `[/]` renders as a half-filled checkbox. Confirm right-click on any checkbox lists all 6 non-current types (including In-Progress).
5. In Editor mode: Open the command palette, type "Change bullet to In-Progress" — the command appears. Cursor on a bullet line, run it, confirm the source becomes `- [/] ...`.
6. Report manual-test result before committing.

- [ ] **Step 6: Commit**

```bash
git add src/core/bullet-types.ts styles.css tests/core/bullet-utils.test.ts
git commit -m "feat: add [/] In-Progress bullet type (#6)"
```

---

## Task 5: Live-preview signifier coloring (issue #3 primary ask)

**Files:**
- Create: `src/editor/signifier-extension.ts`
- Create: `tests/editor/signifier-extension.test.ts`
- Modify: `src/index.ts`
- Modify: `styles.css` (scope the signifier color so it applies in both reading + editor modes)

Approach: a CodeMirror 6 `ViewPlugin` maintains a `DecorationSet`. On every `update`, it scans the `view.visibleRanges`, finds lines that are list items (regex `^\s*-(?:\s\[.\])?\s+(<sig>) `) and adds a `Decoration.mark({ class: "bujo-bullet-signifier" })` spanning just the signifier character. CodeMirror handles re-rendering; Obsidian mounts the class to the DOM; existing CSS on `.bujo-bullet-signifier` does the rest.

- [ ] **Step 1: Install CodeMirror peer deps for tests**

The bundle already externalizes `@codemirror/*`; Obsidian ships them at runtime. For tests we need the packages locally:

```bash
npm install --save-dev @codemirror/view@^6.26.0 @codemirror/state@^6.4.0
```

- [ ] **Step 2: Write failing test**

Create `tests/editor/signifier-extension.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { signifierExtension } from "src/editor/signifier-extension";

function buildView(doc: string, signifiers: { name: string; value: string }[]) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const state = EditorState.create({
    doc,
    extensions: [signifierExtension(() => signifiers)],
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
    const view = buildView("- ! priority", () => sigs as never);
    // No signifier set yet: no decoration
    expect(view.dom.querySelector(".bujo-bullet-signifier")).toBeNull();
    sigs.push({ name: "Priority", value: "!" });
    view.dispatch({ changes: { from: 0, to: 0, insert: "" } });
    expect(view.dom.querySelector(".bujo-bullet-signifier")).not.toBeNull();
    view.destroy();
  });
});
```

Run:

```bash
npm test -- tests/editor/signifier-extension.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the extension**

Create `src/editor/signifier-extension.ts`:

```ts
import { Extension, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

export interface Signifier {
  name: string;
  value: string;
}

export type SignifierProvider = () => Signifier[];

export function signifierExtension(getSignifiers: SignifierProvider): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view, getSignifiers());
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) {
          this.decorations = build(u.view, getSignifiers());
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
  return plugin;
}

function build(view: EditorView, signifiers: Signifier[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const active = signifiers.filter((s) => s.value && s.value.length > 0);
  if (active.length === 0) return builder.finish();

  const mark = Decoration.mark({ class: "bujo-bullet-signifier" });

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos < to) {
      const line = view.state.doc.lineAt(pos);
      const match = matchLine(line.text, active);
      if (match) {
        builder.add(line.from + match.start, line.from + match.start + match.length, mark);
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

function matchLine(text: string, signifiers: Signifier[]): { start: number; length: number } | null {
  const m = text.match(/^\s*-(?:\s\[.\])?\s+/);
  if (!m) return null;
  const prefixLen = m[0].length;
  const rest = text.slice(prefixLen);
  for (const sig of signifiers) {
    if (rest.startsWith(sig.value + " ")) {
      return { start: prefixLen, length: sig.value.length };
    }
  }
  return null;
}
```

Run:

```bash
npm test -- tests/editor/signifier-extension.test.ts
```

Expected: all 5 pass.

- [ ] **Step 4: Wire the extension into the plugin**

Modify `src/index.ts`. Add import:

```ts
import { signifierExtension } from "./editor/signifier-extension";
```

Inside `onload()`, after `this.commandHandler = new CommandHandler(this);` and before `this.registerMarkdownPostProcessor(...)`, add:

```ts
    this.registerEditorExtension(signifierExtension(() => this.settings.signifiers));
```

Note: the provider is a function closure so settings changes take effect on the next viewport update without re-registering the extension.

- [ ] **Step 5: Trigger a re-decoration when settings change**

In `src/settings.ts`, the three `onChange` handlers (signifier value, signifier name, add/remove signifier) already call `this.plugin.saveSettings()`. Add a line after each `saveSettings()` call to nudge every open editor:

```ts
this.plugin.refreshEditors();
```

And add this method to `BuJoPlugin` in `src/index.ts` (below `saveSettings`):

```ts
  refreshEditors(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as { editor?: { cm?: EditorView } };
      const cm = view?.editor?.cm;
      if (cm) {
        cm.dispatch({});
      }
    });
  }
```

Add the import at the top:

```ts
import type { EditorView } from "@codemirror/view";
```

- [ ] **Step 6: Scope the signifier color rule to both views**

The `.bujo-bullet-signifier` CSS currently applies everywhere the class appears. Reading view already works. Live preview will now set the class too via CodeMirror. No selector change needed — verify nothing else in the codebase scopes the class by ancestor. Inspect `styles.css` line 87-89 is as-is:

```css
.bujo-bullet-signifier {
  color: var(--text-error);
}
```

If the CSS has `.markdown-preview-view .bujo-bullet-signifier` anywhere, broaden it. After grep:

```bash
grep -n "bujo-bullet-signifier" styles.css
```

Expected: only the single `.bujo-bullet-signifier { color: var(--text-error); }` rule. No changes needed.

- [ ] **Step 7: Typecheck + build**

Run:

```bash
npm run build
```

Expected: success.

- [ ] **Step 8: Manual-verify in Obsidian sandbox vault**

Same vault as Task 4, step 5. In Editor/Live Preview mode, type:

```
- ! priority
- [ ] ? follow up
```

Confirm `!` and `?` render red. Toggle to Reading view; confirm still red. Open plugin settings, add a new signifier `#`, go back to the note and type `- # test` — confirm `#` turns red without reopening the note.

- [ ] **Step 9: Commit**

```bash
git add src/editor/signifier-extension.ts tests/editor/signifier-extension.test.ts src/index.ts src/settings.ts package.json package-lock.json
git commit -m "feat: color signifiers in Live Preview (#3)"
```

---

## Task 6: Update CHANGELOG and version

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json` (via `npm version`)

- [ ] **Step 1: Add CHANGELOG entry**

At the top of `CHANGELOG.md`, after the header and before `## 1.2.1`, insert:

```markdown
## 1.3.0 - 2026-04-21

### Added

- `- [/]` In-Progress bullet type with matching icon and command
- Signifier coloring now applies in Live Preview, not just Reading view

### Fixed

- Signifiers no longer double-wrap or corrupt inline content when the signifier character appears later on the line (#3)
- Removed duplicated iteration over checkbox list items (#3, supersedes #4)
```

- [ ] **Step 2: Bump version**

Run:

```bash
npm version minor
```

This runs the `version` script (`version-bump.mjs`), which updates `manifest.json` and `versions.json` and stages them. `package.json` and `package-lock.json` are also updated; `npm version` creates a commit automatically.

Expected: new commit `1.3.0`, tag `v1.3.0` created.

- [ ] **Step 3: Verify build and tests one final time**

Run:

```bash
npm run build && npm test
```

Expected: both succeed.

- [ ] **Step 4: Commit CHANGELOG if `npm version` did not include it**

`npm version` commits only files it modified. If `CHANGELOG.md` was not included, amend-free:

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for 1.3.0"
```

(Do NOT amend the version commit — the tag already points at it.)

---

## Self-Review Checklist

- Spec coverage: #3 DOM double-wrap → Task 3; #3 live-preview → Task 5; #3 selector overlap → Task 3; PR #4 → Task 3 supersedes; #6 → Task 4. #5 explicitly deferred. ✓
- Placeholder scan: no TBDs, every code block is complete runnable code. ✓
- Type consistency: `Bullet`, `AVAILABLE_BULLETS_TYPES` moved to `src/core/bullet-types.ts` in Task 1, referenced consistently. `Signifier` type defined in both `src/core/signifier.ts` and `src/editor/signifier-extension.ts` — intentional duplicate to keep modules independent; both match the settings shape `{ name: string; value: string }`. ✓
- Manual-verification steps are called out explicitly (Task 4 step 5, Task 5 step 8) since there is no way to fully automate Obsidian rendering. ✓
