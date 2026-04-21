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
