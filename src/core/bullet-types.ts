export type Bullet = {
  name: string;
  character: string;
};

export const AVAILABLE_BULLETS_TYPES: Bullet[] = [
  { name: "Incomplete", character: " " },
  { name: "Complete", character: "x" },
  { name: "Irrelevant", character: "-" },
  { name: "Migrated", character: ">" },
  { name: "Scheduled", character: "<" },
  { name: "Event", character: "o" },
];
