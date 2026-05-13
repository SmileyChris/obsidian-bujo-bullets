import { App, SuggestModal } from 'obsidian';
import { AVAILABLE_BULLETS_TYPES, Bullet } from '../core/bullet-types';

export class BulletSuggesterModal extends SuggestModal<Bullet> {
  private currentChar: string | undefined;
  private onSubmit: (bullet: Bullet) => void;

  constructor(
    app: App,
    currentChar: string | undefined,
    onSubmit: (bullet: Bullet) => void,
  ) {
    super(app);
    this.currentChar = currentChar;
    this.onSubmit = onSubmit;
    this.setPlaceholder('Choose bullet type…');
    this.setInstructions([
      { command: '', purpose: 'Pick a bullet type to apply to the current task' },
    ]);
  }

  getSuggestions(query: string): Bullet[] {
    return AVAILABLE_BULLETS_TYPES.filter(
      (bullet) =>
        bullet.character !== this.currentChar &&
        bullet.name.toLowerCase().includes(query.toLowerCase()),
    );
  }

  renderSuggestion(bullet: Bullet, el: HTMLElement): void {
    el.createSpan({ text: `- [${bullet.character}]  ${bullet.name}` });
  }

  onChooseSuggestion(bullet: Bullet): void {
    this.onSubmit(bullet);
  }
}
