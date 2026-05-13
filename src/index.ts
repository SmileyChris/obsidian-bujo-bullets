import { Menu, Plugin } from 'obsidian';
import type { EditorView } from "@codemirror/view";
import { CommandHandler } from './handlers/command-handler';
import { EditorMenuHandler } from './handlers/editor-menu-handler';
import { BulletSuggesterModal } from './handlers/bullet-suggester-modal';
import { isBulletText, updateBulletType } from './core/bullet-utils';
import { wrapSignifiers } from './core/signifier';
import { signifierExtension } from './editor/signifier-extension';
import { deferredEventExtension } from './editor/deferred-event-extension';
import { DAY_SUFFIX_RE } from './core/dynamic-event-bullet';
import {
  BuJoPluginSettings,
  BuJoPluginSettingTab,
  DEFAULT_SETTINGS
} from './settings';
import { AVAILABLE_BULLETS_TYPES, Bullet } from "./core/bullet-types";

export { AVAILABLE_BULLETS_TYPES } from "./core/bullet-types";
export type { Bullet } from "./core/bullet-types";

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
            editor.setLine(cursor.line, updateBulletType(line, bullet));
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

    for (const type of AVAILABLE_BULLETS_TYPES) {
      if (currentBulletType.character === type.character) continue;

      menu.addItem((item) => {
        item.setTitle(`Change to: ${type.name}`);
        item.onClick(async () => {
          const vault = this.app.vault;
          const file = this.app.workspace.getActiveFile();
          if (!file) return;

          vault.process(file, (data) => {
            const lines = data.split('\n');
            let bulletCount = 0;
            let bulletIndex = -1;
            let lineIndex = -1;
            for (let i = 0; i < lines.length; i++) {
              lineIndex++;
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

            const updatedLines = [
              ...lines.slice(0, lineIndex),
              updateBulletType(lines[bulletIndex], type),
              ...lines.slice(bulletIndex + 1),
            ];

            return updatedLines.join('\n');
          });
        });
      });
    }

    menu.showAtPosition({ x, y });
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

  const m = text.nodeValue.match(DAY_SUFFIX_RE);
  if (!m) return;

  const day = (m[1] ?? "").toUpperCase();
  text.nodeValue = text.nodeValue.slice(m[0].length).replace(/^\s/, "");
  li.setAttribute("data-bujo-day", day);
  // The day text overlay is drawn by CSS `::before` reading
  // `attr(data-bujo-day)` — no sibling element required.
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
