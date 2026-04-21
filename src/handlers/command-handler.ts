import BuJoPlugin from "src";
import { AVAILABLE_BULLETS_TYPES } from "../core/bullet-types";
import { isBulletText, updateBulletType } from "../core/bullet-utils";

export class CommandHandler {
  private plugin: BuJoPlugin;

  constructor(plugin: BuJoPlugin) {
    this.plugin = plugin;
    this.setup();
  }

  setup() {
    AVAILABLE_BULLETS_TYPES.forEach(({ name, character }) => {
      this.plugin.addCommand({
        id: `change-bullet-to-${character.toLowerCase()}`,
        name: `Change bullet to ${name}`,
        editorCheckCallback: (checking, editor, view) => {
          const cursor = editor.getCursor()
          const line = editor.getLine(cursor.line)
          const isBullet = isBulletText(line)

          if (isBullet) {
            if (!checking) {
              const newType = AVAILABLE_BULLETS_TYPES.find(
                (type) => type.character === character
              )

              if (!newType) {
                console.error(`Type ${character} not found`)
                return false
              }
              
              const newText = updateBulletType(line, newType)
              editor.setLine(cursor.line, newText)
            }
      
            return true
          }
      
          return false;
        },
      });
    });
  }
}