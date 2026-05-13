import { Bullet } from "./bullet-types";

export function updateBulletType(original: string, newType: Bullet): string {
  if (!isBulletText(original)) {
    throw new Error("The provided text is not a valid bullet point.");
  }

  return original.replace(/- \[[^\]]*\]/, `- [${newType.character}]`);
}

export function isBulletText(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("- [");
}

/**
 * Apply a bullet-type change with event-aware semantics.
 *
 * For an `[o]` event line:
 *   - Complete (x) / Cancelled (-)  → add/replace `[x]` / `[-]` status suffix
 *   - Migrated (>) / Scheduled (<)  → add/replace `[>]` / `[<]` action suffix
 *   - Event (o)                     → clear any status/action suffix (revert)
 *   - anything else                 → rewrite the primary marker (loses event-ness)
 *
 * Status and action are mutually exclusive (setting one clears the other).
 * Day suffixes like `[>Thu]` are preserved through any transition.
 */
export function applyBulletChange(original: string, target: Bullet): string {
  if (!isBulletText(original)) {
    throw new Error("The provided text is not a valid bullet point.");
  }

  const currentChar = original.match(/- \[([^\]]*)\]/)?.[1];
  if (currentChar === "o") {
    if (target.character === "x" || target.character === "-") {
      return setEventSingleCharSuffix(original, target.character);
    }
    if (target.character === ">" || target.character === "<") {
      return setEventSingleCharSuffix(original, target.character);
    }
    if (target.character === "o") {
      return clearEventStateSuffixes(original);
    }
  }
  return updateBulletType(original, target);
}

/** Does the line carry a status (`[x]`/`[-]`) or action (`[>]`/`[<]`) suffix? */
export function hasEventStatus(line: string): boolean {
  return /^\s*-\s\[o\]\s+(?:\[[^\]]+\]\s+)*\[[xX\-<>]\](?:\s|$)/.test(line);
}

/**
 * Strip any single-char state suffix (`[x]`/`[-]`/`[>]`/`[<]`) from the
 * event's token chain, then append the new one. Day suffixes are kept.
 */
function setEventSingleCharSuffix(line: string, marker: string): string {
  const m = line.match(/^(\s*-\s\[o\]\s+)((?:\[[^\]]+\]\s+)*)(.*)$/);
  if (!m) return line;
  const [, prefix, existingTokens, rest] = m;
  const cleanedTokens = existingTokens.replace(/\[[xX\-<>]\]\s+/g, "");
  return `${prefix}${cleanedTokens}[${marker}] ${rest}`;
}

function clearEventStateSuffixes(line: string): string {
  const m = line.match(/^(\s*-\s\[o\]\s+)((?:\[[^\]]+\]\s+)*)(.*)$/);
  if (!m) return line;
  const [, prefix, existingTokens, rest] = m;
  const cleanedTokens = existingTokens.replace(/\[[xX\-<>]\]\s+/g, "");
  return `${prefix}${cleanedTokens}${rest}`;
}