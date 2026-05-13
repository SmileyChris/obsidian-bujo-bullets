/**
 * Parsing helpers for the event suffix syntax.
 *
 * Source contract: a single-char `[o]` task followed by zero or more
 * bracketed suffix tokens, in any order:
 *
 *   - [o] task              → upcoming event
 *   - [o] [>Thu] task       → deferred to a specific day (renders day overlay)
 *   - [o] [x] task          → completed event
 *   - [o] [-] task          → cancelled event
 *   - [o] [>] task          → migrated event (action; arrow icon)
 *   - [o] [<] task          → scheduled event (action; arrow icon)
 *
 * Combinations are allowed (e.g. `[o] [>Thu] [x] task` → completed event
 * that was deferred to Thursday). The primary `[o]` keeps Obsidian's native
 * task-list parsing (checkbox, swap commands).
 */

/** Match one bracketed suffix token at the start of text. Excludes `[[` (wikilinks). */
export const SUFFIX_TOKEN_RE = /^\s*\[([^\[\]]+)\](?:\s|$)/;

export type SuffixKind =
  | { kind: "day"; value: string }
  | { kind: "status"; value: "done" | "cancelled" }
  | { kind: "action"; value: "migrated" | "scheduled" };

/** Categorize a suffix token's inner content. Returns null if not recognized. */
export function categorizeSuffix(content: string): SuffixKind | null {
  const day = content.match(/^>([A-Za-z]{3})$/);
  if (day) return { kind: "day", value: day[1].toUpperCase() };
  if (content === ">") return { kind: "action", value: "migrated" };
  if (content === "<") return { kind: "action", value: "scheduled" };
  if (/^[xX]$/.test(content)) return { kind: "status", value: "done" };
  if (content === "-") return { kind: "status", value: "cancelled" };
  return null;
}
