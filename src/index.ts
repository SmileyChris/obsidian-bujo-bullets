import { Menu, Plugin } from 'obsidian';
import type { EditorView } from "@codemirror/view";
import { CommandHandler } from './handlers/command-handler';
import { EditorMenuHandler } from './handlers/editor-menu-handler';
import { BulletSuggesterModal } from './handlers/bullet-suggester-modal';
import { applyBulletChange, isBulletText } from './core/bullet-utils';
import { wrapSignifiers } from './core/signifier';
import { signifierExtension } from './editor/signifier-extension';
import { deferredEventExtension } from './editor/deferred-event-extension';
import { SUFFIX_TOKEN_RE, categorizeSuffix } from './core/dynamic-event-bullet';
import {
  BuJoPluginSettings,
  BuJoPluginSettingTab,
  DEFAULT_SETTINGS
} from './settings';
import { AVAILABLE_BULLETS_TYPES, Bullet } from "./core/bullet-types";

export { AVAILABLE_BULLETS_TYPES } from "./core/bullet-types";
export type { Bullet } from "./core/bullet-types";

const COMPLETE_BULLET = AVAILABLE_BULLETS_TYPES.find((t) => t.character === 'x')!;

export default class BuJoPlugin extends Plugin {
  settings: BuJoPluginSettings;
  commandHandler: CommandHandler;
  editorMenuHandler: EditorMenuHandler;

  async onload() {
    await this.loadSettings();
    this.commandHandler = new CommandHandler(this);
    this.editorMenuHandler = new EditorMenuHandler(this);

    // Command: open bullet type suggester for the current editor line
    this.addCommand({
      id: 'change-bullet-type',
      name: 'Change bullet type',
      icon: 'list-checks',
      editorCallback: (editor, _view) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        if (!isBulletText(line)) return;
        const currentChar = line.match(/- \[(.)\]/)?.[1];
        const modal = new BulletSuggesterModal(
          this.app,
          currentChar,
          (bullet) => {
            editor.setLine(cursor.line, applyBulletChange(line, bullet));
          },
        );
        modal.open();
      },
    });

    this.registerEditorExtension(signifierExtension(() => this.settings.signifiers));
    this.registerEditorExtension(deferredEventExtension());

    this.registerMarkdownPostProcessor((element, _context) => {
      wrapSignifiers(element, this.settings.signifiers);

      // Detect `- [o] >Day task` deferred-event suffix, stamp `data-bujo-day`,
      // strip the token, and overlay the day on the calendar checkbox.
      let touched = 0;
      let attempted = 0;
      for (const li of element.findAll("li.task-list-item")) {
        attempted++;
        if (li.getAttribute("data-task") !== "o") continue;
        const before = li.hasAttribute("data-bujo-day");
        applyDeferredEventOverlay(li as HTMLElement);
        if (!before && li.hasAttribute("data-bujo-day")) touched++;
      }
      if (attempted > 0) {
        console.debug(`[bujo] scanned ${attempted} task-list-items, applied overlay to ${touched}`);
      }

      const renderedCheckboxes = element.findAll(".task-list-item");
      if (renderedCheckboxes.length === 0) {
        return;
      }

      renderedCheckboxes.forEach((bullet, index) => {
        bullet.setAttribute('data-bullet-id', index.toString())
      })

      for (const bullet of renderedCheckboxes) {
        const bulletTaskValue = bullet.getAttribute('data-task')
        const bulletType = !bulletTaskValue
          ? AVAILABLE_BULLETS_TYPES.find((type) => type.character === ' ')
          : AVAILABLE_BULLETS_TYPES.find((type) => type.character === bulletTaskValue)
        if (!bulletType) {
          continue
        }

        const checkbox = bullet.querySelector('input[type="checkbox"]') as HTMLInputElement | null
        if (!checkbox) {
          continue
        }

        // Block left-click for [o] events and [-] cancelled so the checkbox
        // doesn't toggle the marker (which would destroy the bullet
        // semantics). Right-click still fires below for the swap menu.
        if (bulletType.character === 'o' || bulletType.character === '-') {
          checkbox.addEventListener('click', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
          }, true);
        }

        // Clicking an in-progress [/] checkbox completes the task.
        // Obsidian's native toggle flips it to unchecked ([ ]), losing the
        // progress marker — so take over and write [x] explicitly.
        if (bulletType.character === '/') {
          checkbox.addEventListener('click', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            this.updateBulletInFile(bullet, COMPLETE_BULLET);
          }, true);
        }

        // Desktop: right-click on checkbox
        checkbox.addEventListener('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          this.showBulletMenuForReadingMode(bullet, bulletType, event.clientX, event.clientY);
        });

        // Mobile: long-press on the task list item
        let longPressTimer: number | null = null;
        const LONG_PRESS_MS = 500;

        bullet.addEventListener('touchstart', (e: TouchEvent) => {
          longPressTimer = window.setTimeout(() => {
            longPressTimer = null;
            const touch = e.touches[0];
            this.showBulletMenuForReadingMode(bullet, bulletType, touch.clientX, touch.clientY);
          }, LONG_PRESS_MS);
        });

        bullet.addEventListener('touchend', () => {
          if (longPressTimer !== null) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        });

        bullet.addEventListener('touchmove', () => {
          if (longPressTimer !== null) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        });
      }
    })
  }

  /**
   * Show the bullet change menu for a reading-mode task list item.
   */
  private showBulletMenuForReadingMode(
    bullet: Element,
    currentBulletType: Bullet,
    x: number,
    y: number,
  ): void {
    const menu = new Menu();
    const bulletId = bullet.getAttribute('data-bullet-id');
    // On an [o] event with a status OR action suffix, expose "Change to:
    // Event" so the user can revert to upcoming.
    const hasEventStatus =
      currentBulletType.character === 'o' &&
      (bullet.hasAttribute('data-bujo-status') || bullet.hasAttribute('data-bujo-action'));

    for (const type of AVAILABLE_BULLETS_TYPES) {
      if (currentBulletType.character === type.character && !(type.character === 'o' && hasEventStatus)) continue;

      menu.addItem((item) => {
        item.setTitle(`Change to: ${type.name}`);
        item.onClick(() => {
          this.updateBulletInFile(bullet, type);
        });
      });
    }

    menu.showAtPosition({ x, y });
  }

  /**
   * Rewrite the source line for a reading-mode task-list item to `target`,
   * locating the bullet by its rendered index (`data-bullet-id`).
   */
  private updateBulletInFile(bullet: Element, target: Bullet): void {
    const vault = this.app.vault;
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const bulletId = bullet.getAttribute('data-bullet-id');

    vault.process(file, (data) => {
      const lines = data.split('\n');
      let bulletCount = 0;
      let bulletIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (isBulletText(lines[i])) {
          if (bulletCount.toString() === bulletId) {
            bulletIndex = i;
            break;
          }
          bulletCount++;
        }
      }

      if (bulletIndex === -1) {
        console.error('Bullet not found');
        return data;
      }

      return [
        ...lines.slice(0, bulletIndex),
        applyBulletChange(lines[bulletIndex], target),
        ...lines.slice(bulletIndex + 1),
      ].join('\n');
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new BuJoPluginSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  refreshEditors(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as { editor?: { cm?: EditorView } };
      const cm = view?.editor?.cm;
      if (cm) {
        cm.dispatch({});
      }
    });
  }
}

/**
 * For a `[o]` task-list-item, detect a leading `>` or `>Xxx ` token in the
 * task text. If present, strip it, set `data-bujo-day` on the `<li>`, and
 * wrap the checkbox with a sibling overlay span for the day text.
 */
function applyDeferredEventOverlay(li: HTMLElement): void {
  const input = li.querySelector<HTMLInputElement>("input.task-list-item-checkbox")
    ?? li.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) return;

  // Walk the li for the first text node with any non-whitespace content.
  // Obsidian's reading-mode wraps task content in different ways (tight vs.
  // loose lists, themes), so input.nextSibling is unreliable.
  const text = firstTextNodeIn(li);
  if (!text || !text.nodeValue) return;

  let day: string | null = null;
  let status: "done" | "cancelled" | null = null;
  let action: "migrated" | "scheduled" | null = null;

  // Eat suffix tokens one by one. Each kind can appear at most once; the
  // first unrecognized token (or a duplicate) ends the chain.
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

  // Trim a single leading whitespace left over after the last token strip.
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
