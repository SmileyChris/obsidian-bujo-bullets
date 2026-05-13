import { Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";

/**
 * Live Preview rendering of deferred-event suffixes on `- [o] ...` lines.
 *
 * Adds a line-level `data-bujo-day` attribute (empty / `"THU"` / etc.) so the
 * stylesheet can re-color the native `[o]` checkbox to grey for any deferred
 * form and draw the day text via a CSS `::before` pseudo with `attr()`.
 * Hides the `>Day` source token from view when the cursor isn't on the line.
 */

const LINE_RE = /^(\s*-\s\[o\]\s)(\[>([A-Za-z]{3})?\](?:\s|$))/;

export function deferredEventExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(u: ViewUpdate): void {
        if (u.docChanged || u.viewportChanged || u.selectionSet) {
          this.decorations = build(u.view);
        }
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
      const token = m[2];
      const day = (m[3] ?? "").toUpperCase();

      builder.add(
        line.from,
        line.from,
        Decoration.line({ attributes: { "data-bujo-day": day } }),
      );

      if (!cursorLines.has(line.number)) {
        const start = line.from + prefixLen;
        const end = start + token.length;
        builder.add(start, end, Decoration.replace({}));
      }
    }
  }

  return builder.finish();
}
