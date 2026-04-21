import { Editor, MarkdownView, Menu, MenuItem } from "obsidian";
import type { EditorView } from "@codemirror/view";
import BuJoPlugin from "src";
import { AVAILABLE_BULLETS_TYPES, Bullet } from "../core/bullet-types";
import { isBulletText, updateBulletType } from "../core/bullet-utils";

type MenuItemWithSubmenu = MenuItem & { setSubmenu: () => Menu };
type EditorWithCm = Editor & { cm: EditorView };

export class EditorMenuHandler {
  private plugin: BuJoPlugin;
  private lastContextMenuCoords: { x: number; y: number } | null = null;

  constructor(plugin: BuJoPlugin) {
    this.plugin = plugin;
    this.setup();
  }

  setup() {
    this.plugin.registerDomEvent(
      document,
      "contextmenu",
      (e: MouseEvent) => {
        this.lastContextMenuCoords = { x: e.clientX, y: e.clientY };
      },
      true,
    );

    this.plugin.registerEvent(
      this.plugin.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof MarkdownView)) return;

        const lineNumber = this.resolveClickedLine(editor as EditorWithCm);
        if (lineNumber === null) return;

        const line = editor.getLine(lineNumber);
        if (!isBulletText(line)) return;

        const currentChar = line.match(/- \[(.)\]/)?.[1];

        menu.addItem((item) => {
          item.setTitle("Change bullet to").setIcon("list-checks");
          const submenu = (item as MenuItemWithSubmenu).setSubmenu();
          for (const type of AVAILABLE_BULLETS_TYPES) {
            if (type.character === currentChar) continue;
            submenu.addItem((sub) => {
              sub.setTitle(type.name);
              sub.onClick(() => changeBullet(editor, type, lineNumber));
            });
          }
        });
      }),
    );
  }

  private resolveClickedLine(editor: EditorWithCm): number | null {
    const coords = this.lastContextMenuCoords;
    const cm = editor.cm;
    if (!coords || !cm) return editor.getCursor().line;
    const pos = cm.posAtCoords(coords);
    if (pos === null) return editor.getCursor().line;
    return cm.state.doc.lineAt(pos).number - 1;
  }
}

function changeBullet(editor: Editor, type: Bullet, lineNumber: number): void {
  const line = editor.getLine(lineNumber);
  if (!isBulletText(line)) return;
  editor.setLine(lineNumber, updateBulletType(line, type));
}
