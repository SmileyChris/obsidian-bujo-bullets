import BuJoPlugin from "./index";
import { App, PluginSettingTab, Setting } from "obsidian";

export interface BuJoPluginSettings {
  signifiers: Signifier[];
}

interface Signifier {
  name: string;
  value: string;
}

export const DEFAULT_SETTINGS: Partial<BuJoPluginSettings> = {
  signifiers: [
    { name: "Priority", value: "!" },
    { name: "Follow-up", value: "?" },
  ]
};

export class BuJoPluginSettingTab extends PluginSettingTab {
  plugin: BuJoPlugin;

  constructor(app: App, plugin: BuJoPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();

    this.add_signifiers_setting();
  }


  add_signifiers_setting(): void {
    new Setting(this.containerEl).setName("Signifiers").setHeading();

    const desc = document.createDocumentFragment();
    desc.append(
        "Signifiers are symbols that give your bullets added context. For example, you can use an exclamation mark (!) to indicate a priority task or a question mark (?) to indicate a question to follow up on. Examples:",
        desc.createEl("br"),
        "- [ ] ! Priority task",
        desc.createEl("br"),
        "- ? Follow up on this idea",
        desc.createEl("br"),
        desc.createEl("br"),
        desc.createEl("b", { text: "Warning: " }),
        "The asterisk (*) signifier cannot be used as a signifier because of limitations in the Obsidian Markown renderer. Using it will cause a double bullet to appear in the rendered view."
    );
    new Setting(this.containerEl).setDesc(desc);

    this.plugin.settings.signifiers.forEach((signifier, index) => {
      const sig = new Setting(this.containerEl)
        .addText((cb) => {
          cb.setPlaceholder("Enter signifier")
            .setValue(signifier.value)
            .onChange(async (value) => {
              this.plugin.settings.signifiers[index].value = value;
              await this.plugin.saveSettings();
              this.plugin.refreshEditors();
            })
        })
        .addText((cb) => {
          cb.setPlaceholder("Enter name")
            .setValue(signifier.name)
            .onChange(async (value) => {
              this.plugin.settings.signifiers[index].name = value;
              await this.plugin.saveSettings();
              this.plugin.refreshEditors();
            })
        })
        .addExtraButton((cb) => {
          cb.setIcon("cross")
            .setTooltip("Remove signifier")
            .onClick(async () => {
              this.plugin.settings.signifiers.splice(index, 1);
              await this.plugin.saveSettings();
              this.plugin.refreshEditors();
              // Force refresh
              this.display();
            });
        });
      sig.infoEl.remove();
    });

    new Setting(this.containerEl).addButton((cb) => {
      cb.setButtonText("Add new signifier")
        .setCta()
        .onClick(async () => {
            this.plugin.settings.signifiers.push({ name: "", value: "" });
            await this.plugin.saveSettings();
            this.plugin.refreshEditors();
            // Force refresh
            this.display();
        });
  });
  }
}