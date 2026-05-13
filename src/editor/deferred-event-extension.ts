import { Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { SUFFIX_TOKEN_RE, categorizeSuffix } from "../core/dynamic-event-bullet";

/**
 * Live Preview rendering of event suffix tokens on `- [o] ...` lines.
 *
 * Stamps `data-bujo-day`, `data-bujo-status`, and/or `data-bujo-action`
 * onto the `.cm-line` so CSS can re-color/re-mask the checkbox and draw
 * the day overlay via `::before { content: attr(data-bujo-day) }`. Hides
 * the suffix source tokens from view when the cursor isn't on the line.
 */

/** Match `- [o] ` followed by one or more bracketed suffix tokens. */
const LINE_RE = /^(\s*-\s\[o\]\s)((?:\[[^\[\]]+\](?:\s|$))+)/;

export function deferredEventExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private view: EditorView;
      private onClickCapture: (event: MouseEvent) => void;

      constructor(view: EditorView) {
        this.view = view;
        this.decorations = build(view);

        // Block left-click on [o] event and [-] cancelled checkboxes so the
        // native task toggle doesn't strip the marker. Capture-phase +
        // stopImmediate is required to win against Obsidian's own click
        // handler. Right-click (contextmenu) is left alone.
        this.onClickCapture = (event) => {
          const target = event.target as HTMLElement | null;
          if (!(target instanceof HTMLInputElement)) return;
          if (!target.classList.contains("task-list-item-checkbox")) return;
          const line = target.closest(".cm-line");
          const task = line?.getAttribute("data-task");
          if (task !== "o" && task !== "-") return;
          event.preventDefault();
          event.stopImmediatePropagation();
        };
        view.contentDOM.addEventListener("click", this.onClickCapture, true);
      }

      update(u: ViewUpdate): void {
        if (u.docChanged || u.viewportChanged || u.selectionSet) {
          this.decorations = build(u.view);
        }
      }

      destroy(): void {
        this.view.contentDOM.removeEventListener("click", this.onClickCapture, true);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  const cursorLines = new Set<number>();
  for (const range of view.state.selection.ranges) {
    cursorLines.add(view.state.doc.lineAt(range.head).number);
    if (range.head !== range.anchor) {
      cursorLines.add(view.state.doc.lineAt(range.anchor).number);
    }
  }

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos < to) {
      const line = view.state.doc.lineAt(pos);
      pos = line.to + 1;

      const m = line.text.match(LINE_RE);
      if (!m) continue;

      const prefixLen = m[1].length;
      let span = m[2];

      // Walk the captured span token by token, categorizing each. Bail at
      // the first unrecognized token so we don't mis-claim user content.
      const attributes: Record<string, string> = {};
      let consumed = 0;
      while (consumed < span.length) {
        const tm = span.slice(consumed).match(SUFFIX_TOKEN_RE);
        if (!tm) break;
        const cat = categorizeSuffix(tm[1]);
        if (!cat) break;
        if (cat.kind === "day" && !("data-bujo-day" in attributes)) {
          attributes["data-bujo-day"] = cat.value;
        } else if (cat.kind === "status" && !("data-bujo-status" in attributes)) {
          attributes["data-bujo-status"] = cat.value;
        } else if (cat.kind === "action" && !("data-bujo-action" in attributes)) {
          attributes["data-bujo-action"] = cat.value;
        } else {
          break;
        }
        consumed += tm[0].length;
      }
      if (consumed === 0) continue;

      builder.add(line.from, line.from, Decoration.line({ attributes }));

      if (!cursorLines.has(line.number)) {
        const start = line.from + prefixLen;
        const end = start + consumed;
        builder.add(start, end, Decoration.replace({}));
      }
    }
  }

  return builder.finish();
}
