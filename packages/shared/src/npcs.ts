import { GALLERY_PORTRAITS } from "./floors";
import type { Look } from "./profile";
import type { RoomGame } from "./rooms";

export interface NpcPose {
  x: number;
  z: number;
  /** Facing (radians), same convention as players: 0 faces +z. */
  ry: number;
}

export interface NpcDef {
  id: string;
  name: string;
  scene: "lobby" | "room";
  tint: string;
  scale: number;
  /** Pure function of wall-clock seconds, so every client agrees without network traffic. */
  pose: (t: number) => NpcPose;
  lines: readonly string[];
  /** When set, the NPC wears a character costume instead of being a sheet ghost. */
  look?: Look;
}

/** Heading from a path's velocity (dx/dt, dz/dt). */
const heading = (dx: number, dz: number) => Math.atan2(dx, dz);

export const LOBBY_NPCS: readonly NpcDef[] = [
  {
    id: "wisp",
    name: "Wisp",
    scene: "lobby",
    tint: "#9affd6",
    scale: 0.9,
    pose: (t) => {
      const a = t * 0.25;
      return { x: 4.2 * Math.cos(a), z: 4.2 * Math.sin(a), ry: heading(-Math.sin(a), Math.cos(a)) };
    },
    lines: [
      "Ooooh, a new guest! The doors on the left and right are rooms 1A to 1D.",
      "Psst… Pumpkin Trivia Hall has the best questions.",
      "I used to be a candle. Long story.",
    ],
  },
  {
    id: "booella",
    name: "Boo-ella",
    scene: "lobby",
    tint: "#ffb3d9",
    scale: 1,
    pose: (t) => {
      // Figure eight around the fountain: x = 7 sin a, z = 3 cos 2a never comes near the centre.
      const a = t * 0.16;
      return { x: 7 * Math.sin(a), z: 3 * Math.cos(2 * a), ry: heading(7 * Math.cos(a), -6 * Math.sin(2 * a)) };
    },
    lines: ["Boo! …Sorry, force of habit.", "Press Enter to chat. Ghosts love gossip.", "Try a new costume: the 🎭 button, bottom right."],
  },
  {
    id: "sir-floats",
    name: "Sir Floats-a-Lot",
    scene: "lobby",
    tint: "#c4b5fd",
    scale: 1.15,
    pose: (t) => {
      const a = t * 0.15;
      return { x: 8 * Math.sin(a), z: -6 + 0.5 * Math.sin(t * 0.4), ry: heading(Math.cos(a), 0.0001) };
    },
    lines: [
      "Halt! Who goes th… oh, a guest. Carry on.",
      "Make your own room and lock it. Very exclusive.",
      "Voice chat works inside rooms. Do say hello.",
    ],
  },
  {
    id: "wraps",
    name: "Sergeant Wraps",
    scene: "lobby",
    tint: "#e9dcc0",
    scale: 1.05,
    look: { body: "bone", accent: "ash", head: "round", hat: "none", costume: "mummy" },
    pose: (t) => {
      const a = t * 0.18;
      return { x: 5.5 * Math.sin(a), z: 8.8, ry: heading(Math.cos(a), 0.0001) };
    },
    lines: [
      "No running in the lobby. Floating is fine.",
      "Lost? The elevator is right of the reception desk.",
      "Three thousand years on duty. Still no raise.",
    ],
  },
  {
    id: "mortimer",
    name: "Mortimer, Concierge",
    scene: "lobby",
    tint: "#ffe2b0",
    scale: 1.1,
    look: { body: "midnight", accent: "blood", head: "vampire", hat: "none", costume: "cape" },
    pose: (t) => ({ x: 0.6 * Math.sin(t * 0.3), z: -9.55, ry: 0 }),
    lines: [
      "Checkout is never. Enjoy your stay!",
      "Room service is… mostly ectoplasm.",
      "Meeting a friend? Tell them the door code, like 2B. Floors 2 and 3 have more rooms.",
    ],
  },
];

export const RECEPTIONIST_ID = "mortimer";

export const FLOOR_NPCS: Record<2 | 3 | 4 | 5, readonly NpcDef[]> = {
  2: [
    {
      id: "curator",
      name: "The Curator",
      scene: "lobby",
      tint: "#d9c8ff",
      scale: 1.1,
      look: { body: "ash", accent: "blood", head: "frankenstein", hat: "none", costume: "none" },
      pose: (t) => {
        const a = t * 0.12;
        return { x: 13 * Math.sin(a), z: 1.5 * Math.sin(t * 0.3), ry: heading(Math.cos(a), 0.15 * Math.cos(t * 0.3)) };
      },
      lines: [
        "Mind the portraits. They mind you.",
        "Strut down the runway! Spotlights love a good costume.",
        "The Mirror of Costumes is at the far end. Vanity is encouraged.",
      ],
    },
    {
      id: "whisper",
      name: "Lady Whisper",
      scene: "lobby",
      tint: "#ffb3d9",
      scale: 0.95,
      pose: (t) => {
        const a = t * 0.21;
        return { x: -6 + 4 * Math.cos(a), z: 1.2 * Math.sin(a), ry: heading(-4 * Math.sin(a), 1.2 * Math.cos(a)) };
      },
      lines: ["Shh… the portraits are napping.", "Every door on this floor hides a room. Some are locked.", "I once had a portrait here. Now I'm the frame's ghost."],
    },
  ],
  3: [
    {
      id: "gourdon",
      name: "Gourdon the Gardener",
      scene: "lobby",
      tint: "#c6ff4d",
      scale: 1.1,
      look: { body: "teal", accent: "pumpkin", head: "werewolf", hat: "none", costume: "fur" },
      pose: (t) => {
        const a = t * 0.2;
        return { x: 3.4 * Math.cos(a), z: 3.4 * Math.sin(a), ry: heading(-Math.sin(a), Math.cos(a)) };
      },
      lines: [
        "Don't touch the big ones. They bite. Slightly.",
        "I hid candy among the pumpkins. Don't tell anyone.",
        "The cauldron? Soup. Probably.",
      ],
    },
    {
      id: "mo",
      name: "Moldy Mo",
      scene: "lobby",
      tint: "#8fa37a",
      scale: 1,
      look: { body: "ash", accent: "slime", head: "zombie", hat: "none", costume: "tattered" },
      pose: (t) => {
        const a = t * 0.1;
        return { x: 5 * Math.sin(a), z: 8.5, ry: heading(Math.cos(a), 0.0001) };
      },
      lines: ["Brains? No thanks. I'm on a plant-based diet now.", "Water the pumpkins? I *am* the fertiliser.", "Mmmrrgh. That means hello."],
    },
  ],
  4: [
    {
      id: "chef",
      name: "Chef Bones",
      scene: "lobby",
      tint: "#f4f1de",
      scale: 1.1,
      look: { body: "bone", accent: "blood", head: "skull", hat: "none", costume: "skeleton" },
      // Behind the counter (the counter is an obstacle for guests, not for the cook).
      pose: (t) => {
        const a = t * 0.22;
        return { x: 2 + 5 * Math.sin(a), z: -10.2, ry: Math.cos(a) > 0 ? Math.PI / 2 : -Math.PI / 2 };
      },
      lines: [
        "Order up! Step to the counter and press E.",
        "Today's special: Worm Noodles. Yesterday's special: also Worm Noodles.",
        "I'm all bones, so I never get hungry. I just cook.",
      ],
    },
    {
      id: "crumbs",
      name: "Count Crumbs",
      scene: "lobby",
      tint: "#ffb3d9",
      scale: 1,
      look: { body: "midnight", accent: "violet", head: "vampire", hat: "top", costume: "cape" },
      // Waits tables along the centre aisle.
      pose: (t) => {
        const a = t * 0.12;
        return { x: 12.5 * Math.sin(a), z: 0.3 * Math.sin(t * 0.5), ry: heading(Math.cos(a), 0.0001) };
      },
      lines: [
        "Table for two? Table for four? Table for one very lonely ghost?",
        "Sit down and say hello. Whoever shares your table can hear you.",
        "No garlic bread, I'm afraid. House rules.",
      ],
    },
  ],
  5: [
    {
      id: "stella",
      name: "Stargazer Stella",
      scene: "lobby",
      tint: "#9ad0ff",
      scale: 1,
      look: { body: "violet", accent: "teal", head: "round", hat: "witch", costume: "wizard" },
      pose: (t) => {
        const a = t * 0.18;
        return { x: 10 + 2.2 * Math.cos(a), z: -7.5 + 2.2 * Math.sin(a), ry: heading(-Math.sin(a), Math.cos(a)) };
      },
      lines: [
        "Tonight's moon is extra full. Werewolves, take note.",
        "Read the tombstones. The residents insisted.",
        "That constellation? The Great Pumpkin. Obviously.",
      ],
    },
    {
      id: "zorp",
      name: "Zorp, Tourist",
      scene: "lobby",
      tint: "#c6ff4d",
      scale: 0.95,
      look: { body: "teal", accent: "slime", head: "alien", hat: "none", costume: "none" },
      pose: (t) => {
        const a = t * 0.16;
        return { x: -2 + 3 * Math.cos(a), z: 1 + 2 * Math.sin(a), ry: heading(-3 * Math.sin(a), 2 * Math.cos(a)) };
      },
      lines: ["Greetings, Earth ghost! Your city lights are magnificent.", "On my planet, Halloween is every Tuesday.", "Take me to your candy."],
    },
  ],
};

/** A spot that speaks when you walk up to it (portraits, tombstones). No name tag. */
export interface Talker {
  id: string;
  x: number;
  z: number;
  r: number;
  lines: readonly string[];
}

const PORTRAIT_LINES = [
  ["Stop staring. …Fine, keep staring.", "I was painted in 1693. Still not dry."],
  ["My eyes follow you. It's a whole thing.", "Lovely costume. Mine is oil on canvas."],
  ["Psst. There's a candy near the armour.", "I used to haunt the lobby. Promotion!"],
  ["Smile! …No, the other way.", "I've seen things. Mostly the opposite wall."],
  ["The runway is for costumes, not for running.", "Do I look washed out to you?"],
  ["The mirror at the end shows your best self.", "Frame me in gold, they said. Cheap gold."],
];

const EPITAPHS = [
  "Here lies Cornelius. He took the stairs. There are no stairs.",
  "Gone, but not forgotten. Mostly gone.",
  "Here lies a guest who said “I'll just check out early.”",
  "R.I.P. Wi-Fi password. Nobody remembered you.",
  "She finally found the last candy. Worth it.",
  "Here lies Bob. He tried to pet the giant pumpkin.",
];

export const FLOOR_TALKERS: Record<2 | 3 | 4 | 5, readonly Talker[]> = {
  2: GALLERY_PORTRAITS.map((x, i) => ({ id: `portrait-${i}`, x, z: -3.9, r: 1.6, lines: PORTRAIT_LINES[i] ?? ["…"] })),
  3: [],
  4: [],
  5: [
    { x: -11, z: 4 },
    { x: -8.5, z: 4 },
    { x: -6, z: 4 },
    { x: -11, z: 7 },
    { x: -8.5, z: 7 },
    { x: -6, z: 7 },
  ].map((p, i) => ({ id: `tomb-${i}`, x: p.x, z: p.z + 0.7, r: 1.3, lines: [EPITAPHS[i] ?? "R.I.P."] })),
};

export function greeting(name: string): string {
  return `Welcome to Ghostel, ${name}! Rooms and games are through the glowing doors 🚪`;
}

export function roomHost(game: RoomGame): NpcDef {
  return {
    id: "host",
    name: "The Host",
    scene: "room",
    tint: game === "pumpkin_trivia" ? "#ffcf7a" : "#9affd6",
    scale: 1,
    // An ellipse around the long table and its chairs.
    pose: (t) => {
      const a = t * 0.2;
      return { x: 4.6 * Math.cos(a), z: -0.5 + 2.6 * Math.sin(a), ry: heading(-4.6 * Math.sin(a), 2.6 * Math.cos(a)) };
    },
    lines:
      game === "pumpkin_trivia"
        ? ["Fancy a game? Press 🎃 Play Pumpkin Trivia!", "Seven questions, fifteen seconds each. No pressure… mwahaha.", "Even Jack O'Bot gets one wrong sometimes."]
        : ["Make yourself at home. Take a seat at the long table to meet face to face.", "This room is for hanging out. Pull up a coffin."],
  };
}

/** How close (world units) a guest must be for an NPC to speak. */
export const NPC_TALK_RADIUS = 2.4;
export const NPC_TALK_COOLDOWN_MS = 8000;
