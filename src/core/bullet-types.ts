export type Bullet = {
  name: string;
  character: string;
};

export const AVAILABLE_BULLETS_TYPES: Bullet[] = [
  { name: "Incomplete", character: " " },
  { name: "In-Progress", character: "/" },
  { name: "Complete", character: "x" },
  { name: "Cancelled", character: "-" },
  { name: "Migrated", character: ">" },
  { name: "Scheduled", character: "<" },
  { name: "Event", character: "o" },
];
