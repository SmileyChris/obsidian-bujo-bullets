import { Menu, Plugin } from 'obsidian';
import type { EditorView } from "@codemirror/view";
import { CommandHandler } from './handlers/command-handler';
import { EditorMenuHandler } from './handlers/editor-menu-handler';
import { isBulletText, updateBulletType } from './core/bullet-utils';
import { wrapSignifiers } from './core/signifier';
import { signifierExtension } from './editor/signifier-extension';
import {
  BuJoPluginSettings,
  BuJoPluginSettingTab,
  DEFAULT_SETTINGS
} from './settings';
import { AVAILABLE_BULLETS_TYPES } from "./core/bullet-types";

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

    this.registerEditorExtension(signifierExtension(() => this.settings.signifiers));

    this.registerMarkdownPostProcessor((element, _context) => {
      wrapSignifiers(element, this.settings.signifiers);

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

        checkbox.addEventListener('contextmenu', (event: MouseEvent) => {
          const menu = new Menu()
          const bulletId = bullet.getAttribute('data-bullet-id')

          for (const type of AVAILABLE_BULLETS_TYPES) {
            if (bulletType.character === type.character) {
              continue
            }

            menu.addItem((item) => {
              item.setTitle(`Change to: ${type.name}`)
              item.onClick(async () => {
                
                const vault = this.app.vault
                const file = this.app.workspace.getActiveFile()
                if (!file) {
                  return
                }

                vault.process(file, (data) => {
                  const lines = data.split('\n')
                  let bulletCount = 0
                  let bulletIndex = -1
                  let lineIndex = -1
                  for (let i = 0; i < lines.length; i++) {
                    lineIndex++
                    if (isBulletText(lines[i])) {
                      if (bulletCount.toString() === bulletId) {
                        bulletIndex = i
                        break
                      }
                      bulletCount++
                    }
                  }

                  if (bulletIndex === -1) {
                    console.error('Bullet not found')
                    return data
                  }

                  const updatedLines = [
                    ...lines.slice(0, lineIndex),
                    updateBulletType(lines[bulletIndex], type),
                    ...lines.slice(bulletIndex + 1)
                  ]

                  return updatedLines.join('\n')
                });
              })
            })
          }

          menu.showAtPosition({ x: event.clientX, y: event.clientY });
        })
      }
    })
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
