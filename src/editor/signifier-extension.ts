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
        this.decorations = build(u.view, getSignifiers());
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
