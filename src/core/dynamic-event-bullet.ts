/**
 * Parsing helpers for deferred-event day suffixes.
 *
 * Source contract: a single-char `[o]` task followed by a bracketed day token:
 *   - [o] task                  → current-day event (no suffix)
 *   - [o] [>] task              → deferred to unspecified day
 *   - [o] [>Thu] task           → deferred to Thursday (case-insensitive)
 *
 * The `[o]` keeps Obsidian's native task-list parsing (checkbox, click,
 * existing swap commands). The `[>Xxx]` lives in the task text — Obsidian
 * treats it as literal because it isn't single-char.
 */

/** Match `[>]` or `[>Xxx]` (3-letter day) at the start of task text. */
export const DAY_SUFFIX_RE = /^\s*\[>([A-Za-z]{3})?\](?:\s|$)/;
