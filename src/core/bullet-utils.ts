import { Bullet } from "./bullet-types";

export function updateBulletType(original: string, newType: Bullet): string {
  if (!isBulletText(original)) {
    throw new Error("The provided text is not a valid bullet point.");
  }

  return original.replace(/- \[.\]/, `- [${newType.character}]`);
}

export function isBulletText(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("- [");
}