import type { FloorNumber } from "./floors";

export interface CandyDef {
  id: string;
  floor: FloorNumber;
  x: number;
  z: number;
  kind: "wrapped" | "lollipop" | "corn";
}

/** Three per floor on floors 1, 2, 3 and 5 (the Diner on floor 4 has none). Positions are checked by unit tests to be walkable. */
export const CANDIES: readonly CandyDef[] = [
  { id: "lobby-welcome", floor: 1, x: 4.6, z: 7.7, kind: "wrapped" },
  { id: "lobby-west", floor: 1, x: -12.8, z: -7.6, kind: "corn" },
  { id: "lobby-corner", floor: 1, x: 11.6, z: -9.3, kind: "lollipop" },
  { id: "gallery-mirror", floor: 2, x: 16.8, z: -4.2, kind: "lollipop" },
  { id: "gallery-runway", floor: 2, x: 0, z: -2.6, kind: "wrapped" },
  { id: "gallery-armour", floor: 2, x: -9, z: 4.2, kind: "corn" },
  { id: "greenhouse-cauldron", floor: 3, x: 0, z: -3.4, kind: "corn" },
  { id: "greenhouse-pumpkin", floor: 3, x: -8, z: -8.6, kind: "wrapped" },
  { id: "greenhouse-corner", floor: 3, x: 10.5, z: 10, kind: "lollipop" },
  { id: "rooftop-graves", floor: 5, x: -8.5, z: 5.5, kind: "wrapped" },
  { id: "rooftop-telescope", floor: 5, x: 13.2, z: -9.6, kind: "lollipop" },
  { id: "rooftop-crypt", floor: 5, x: 13.2, z: 9.6, kind: "corn" },
];

/** The client asks to collect within this distance… */
export const CANDY_REACH = 1.2;
/** …and the server accepts up to this distance from its own position (allows for network lag). */
export const CANDY_SERVER_REACH = 2;
export const CROWN_CANDIES = CANDIES.length;

const CANDY_IDS = new Set(CANDIES.map((c) => c.id));

export function isCandyId(value: unknown): value is string {
  return typeof value === "string" && CANDY_IDS.has(value);
}

/** Keeps only known, unique candy ids (stored data is re-validated on read). */
export function cleanCandies(list: readonly unknown[]): string[] {
  return [...new Set(list.filter(isCandyId))];
}

export function crownUnlocked(found: readonly string[]): boolean {
  return cleanCandies(found).length >= CROWN_CANDIES;
}
