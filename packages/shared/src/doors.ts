import type { Vec2 } from "./layout";
import type { PublicRoom } from "./rooms";

export type RoomFloor = 1 | 2 | 3;
export const ROOM_FLOORS: readonly RoomFloor[] = [1, 2, 3];

export const DOOR_SLOTS: Record<RoomFloor, readonly string[]> = {
  1: ["A", "B", "C", "D"],
  2: ["A", "B", "C", "D", "E", "F"],
  3: ["A", "B", "C", "D"],
};

/** Which wall a door is on: north faces +z, west faces +x, east faces −x. */
export type DoorFacing = "north" | "west" | "east";

export interface DoorDef {
  code: string;
  floor: RoomFloor;
  slot: string;
  x: number;
  z: number;
  facing: DoorFacing;
}

export const doorCode = (floor: number, slot: string) => `${floor}${slot}`;

const LOBBY_DOORS_DEF: DoorDef[] = [
  { code: "1A", floor: 1, slot: "A", x: -14, z: -3, facing: "west" },
  { code: "1B", floor: 1, slot: "B", x: -14, z: 3, facing: "west" },
  { code: "1C", floor: 1, slot: "C", x: 14, z: -3, facing: "east" },
  { code: "1D", floor: 1, slot: "D", x: 14, z: 3, facing: "east" },
];

/** Gallery doors sit between the portraits on the north wall. */
export const GALLERY_DOOR_X: readonly number[] = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
/** Greenhouse doors flank the elevator on the north wall. */
export const GREENHOUSE_DOOR_X: readonly number[] = [-9, -4.5, 4.5, 9];

export const DOORS: readonly DoorDef[] = [
  ...LOBBY_DOORS_DEF,
  ...GALLERY_DOOR_X.map((x, i) => {
    const slot = DOOR_SLOTS[2][i] as string;
    return { code: doorCode(2, slot), floor: 2 as const, slot, x, z: -5, facing: "north" as const };
  }),
  ...GREENHOUSE_DOOR_X.map((x, i) => {
    const slot = DOOR_SLOTS[3][i] as string;
    return { code: doorCode(3, slot), floor: 3 as const, slot, x, z: -11, facing: "north" as const };
  }),
];

export function doorsOnFloor(floor: number): DoorDef[] {
  return DOORS.filter((d) => d.floor === floor);
}

export function findDoor(floor: number, slot: string): DoorDef | undefined {
  return DOORS.find((d) => d.floor === floor && d.slot === slot);
}

export function isRoomFloor(value: unknown): value is RoomFloor {
  return value === 1 || value === 2 || value === 3;
}

export function isSlotOf(floor: RoomFloor, slot: unknown): slot is string {
  return typeof slot === "string" && DOOR_SLOTS[floor].includes(slot);
}

/** A point `distance` in front of a door, inside the room it opens onto. */
export function inFrontOf(door: DoorDef, distance: number): Vec2 {
  switch (door.facing) {
    case "north":
      return { x: door.x, z: door.z + distance };
    case "west":
      return { x: door.x + distance, z: door.z };
    case "east":
      return { x: door.x - distance, z: door.z };
  }
}

export const DOOR_ZONE_RADIUS = 1.3;
/** Where a guest stands after leaving a room through this door. */
export const doorArrival = (door: DoorDef): Vec2 => inFrontOf(door, 1.5);

/** What everyone on a floor sees on a door. */
export interface DoorInfo {
  code: string;
  floor: RoomFloor;
  slot: string;
  room: PublicRoom | null;
  occupants: number;
}
