export class Plugin {}
export class PluginSettingTab {}
export class Setting {
  constructor(public containerEl: HTMLElement) {}
  setName() { return this; }
  setDesc() { return this; }
  setHeading() { return this; }
  addText() { return this; }
  addButton() { return this; }
  addExtraButton() { return this; }
  get infoEl() { return document.createElement("div"); }
}
export class Menu {
  addItem() { return this; }
  showAtPosition() {}
}
export type App = unknown;
export type Editor = unknown;
export type MarkdownView = unknown;
