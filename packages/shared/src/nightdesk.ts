// The Night Desk: a short text adventure on the lobby's 1987 hotel terminal (M16).
// It runs in the browser only: nothing is sent to the server, stored or rewarded.
// The story and every line of text were written for Ghostel.

export const NIGHT_DESK_INPUT_MAX = 40;
export const NIGHT_DESK_LOG_MAX = 120;

export type NightDeskRoom = "desk" | "office" | "corridor" | "closet" | "room13";
type Direction = "north" | "south" | "east" | "west";

export interface NightDeskState {
  readonly room: NightDeskRoom;
  readonly has: { readonly ledger: boolean; readonly key: boolean };
  readonly bellRung: boolean;
  readonly doorOpen: boolean;
  readonly done: boolean;
  /** Commands that act in the story (HELP, LOOK, WHO… do not count). */
  readonly moves: number;
}

/** Data the browser already has, shown by WHO and ROOMS. */
export interface NightDeskContext {
  readonly guests: readonly string[];
  readonly doors: readonly { readonly code: string; readonly name: string | null }[];
}

export interface NightDeskResult {
  state: NightDeskState;
  lines: string[];
  /** Clear the screen before printing `lines`. */
  clear?: boolean;
  /** Close the terminal after printing `lines`. */
  exit?: boolean;
}

const INITIAL: NightDeskState = {
  room: "desk",
  has: { ledger: false, key: false },
  bellRung: false,
  doorOpen: false,
  done: false,
  moves: 0,
};

const BOOT = [
  "GHOSTEL NIGHT DESK SYSTEM V1.3",
  "(C) 1987 HOLLOW & SONS COMPUTING",
  "MEMORY CHECK ... 640K OK",
  "",
  "YOU ARE THE NIGHT CLERK. IT IS 3:13 AM.",
  "ONE GUEST NEVER CHECKED OUT.",
  "TYPE HELP FOR COMMANDS.",
  "",
];

const HELP = [
  "COMMANDS:",
  "  LOOK (L)          N, S, E, W  (OR GO NORTH)",
  "  TAKE <THING>      READ <THING>",
  "  RING <THING>      SEARCH <THING>",
  "  OPEN <THING>      SIGN <THING>",
  "  INVENTORY (I)     WHO   ROOMS",
  "  CLEAR   RESTART   EXIT",
];

const DIRECTIONS: Record<string, Direction> = {
  N: "north",
  NORTH: "north",
  S: "south",
  SOUTH: "south",
  E: "east",
  EAST: "east",
  W: "west",
  WEST: "west",
};

function exits(s: NightDeskState): Partial<Record<Direction, NightDeskRoom>> {
  switch (s.room) {
    case "desk":
      return { north: "office", east: "corridor" };
    case "office":
      return { south: "desk" };
    case "corridor":
      return s.doorOpen ? { west: "desk", north: "closet", east: "room13" } : { west: "desk", north: "closet" };
    case "closet":
      return { south: "corridor" };
    case "room13":
      return { west: "corridor" };
  }
}

function describe(s: NightDeskState): string[] {
  switch (s.room) {
    case "desk":
      return ["FRONT DESK.", "A BRASS BELL SITS BY A DUSTY GUEST BOOK.", "EXITS: NORTH (BACK OFFICE), EAST (CORRIDOR)."];
    case "office":
      return [
        "BACK OFFICE. A KEY CABINET. HOOK 13 IS EMPTY.",
        ...(s.has.ledger ? [] : ["A LEATHER LEDGER LIES OPEN ON THE DESK."]),
        "EXITS: SOUTH.",
      ];
    case "corridor":
      return [
        "EAST CORRIDOR. DOORS 11, 12 AND 14.",
        !s.bellRung
          ? "WHERE 13 SHOULD BE, THERE IS ONLY WALLPAPER."
          : s.doorOpen
            ? "DOOR 13 STANDS OPEN TO THE EAST."
            : "A DOOR MARKED 13 HAS APPEARED. IT IS LOCKED.",
        s.doorOpen ? "EXITS: WEST, NORTH (LINEN CLOSET), EAST (ROOM 13)." : "EXITS: WEST (FRONT DESK), NORTH (LINEN CLOSET).",
      ];
    case "closet":
      return ["LINEN CLOSET. SHEETS HANG LIKE SLEEPING GHOSTS.", ...(s.has.key ? [] : ["SOMETHING GLINTS BETWEEN THE SHEETS."]), "EXITS: SOUTH."];
    case "room13":
      return s.done
        ? ["ROOM 13. THE BED IS MADE. THE AIR IS WARM AGAIN.", "EXITS: WEST."]
        : ["ROOM 13. COLD AIR. A FIGURE SITS ON THE BED.", 'MR. HOLLOW: "HAS ANYONE SIGNED ME OUT?"', "EXITS: WEST."];
  }
}

/** Upper-case, single-spaced, no control or bidi characters. `null` when longer than the limit. */
export function normalizeCommand(raw: unknown): string | null {
  if (typeof raw !== "string") return "";
  const clean = raw
    .normalize("NFC")
    // C0/C1 controls, bidi overrides and isolates, zero-width characters and the BOM.
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return [...clean].length > NIGHT_DESK_INPUT_MAX ? null : clean;
}

export function startNightDesk(): NightDeskResult {
  return { state: INITIAL, lines: [...BOOT, ...describe(INITIAL)] };
}

const act = (state: NightDeskState, next: Partial<NightDeskState>, lines: string[]): NightDeskResult => ({
  state: { ...state, ...next, moves: state.moves + 1 },
  lines,
});

function go(s: NightDeskState, dir: Direction): NightDeskResult {
  const to = exits(s)[dir];
  if (!to) {
    if (s.room === "corridor" && dir === "east") return act(s, {}, [s.bellRung ? "DOOR 13 IS LOCKED." : "YOU PRESS YOUR EAR TO THE WALLPAPER. SOMETHING BREATHES."]);
    return act(s, {}, ["YOU CAN'T GO THAT WAY."]);
  }
  const moved: NightDeskState = { ...s, room: to, moves: s.moves + 1 };
  return { state: moved, lines: describe(moved) };
}

function take(s: NightDeskState, thing: string): NightDeskResult {
  if (thing === "LEDGER") {
    if (s.has.ledger) return act(s, {}, ["YOU ALREADY HAVE THE LEDGER."]);
    if (s.room !== "office") return act(s, {}, ["YOU SEE NO LEDGER HERE."]);
    return act(s, { has: { ...s.has, ledger: true } }, ["TAKEN: THE LEDGER. IT IS COLD TO THE TOUCH."]);
  }
  if (thing === "KEY") {
    if (s.has.key) return act(s, {}, ["YOU ALREADY HAVE THE KEY."]);
    return act(s, {}, [s.room === "closet" ? "YOU CAN'T SEE IT CLEARLY. TRY SEARCHING THE SHEETS." : "YOU SEE NO KEY HERE."]);
  }
  if (thing === "BELL" && s.room === "desk") return act(s, {}, ["IT IS SCREWED TO THE DESK. TRY RINGING IT."]);
  if (thing === "SHEETS" && s.room === "closet") return act(s, {}, ["THE SHEETS DO NOT WANT TO LEAVE."]);
  if (thing === "") return act(s, {}, ["TAKE WHAT?"]);
  return act(s, {}, ["YOU CAN'T TAKE THAT."]);
}

function read(s: NightDeskState, thing: string): NightDeskResult {
  if (thing === "LEDGER" && (s.has.ledger || s.room === "office")) {
    return act(s, {}, ["ROOM 13 . MR. HOLLOW . IN: 31 OCT 1987", "OUT: ________ (NOBODY HAS SIGNED IT)"]);
  }
  if ((thing === "BOOK" || thing === "GUEST BOOK") && s.room === "desk") {
    return act(s, {}, ["THE LAST LINE IS SMUDGED: 'RING FOR SERVICE, AND THE HOTEL REMEMBERS.'"]);
  }
  if (thing === "") return act(s, {}, ["READ WHAT?"]);
  return act(s, {}, ["THERE IS NOTHING TO READ ON THAT."]);
}

function ring(s: NightDeskState, thing: string): NightDeskResult {
  if (s.room !== "desk" || (thing !== "" && thing !== "BELL")) return act(s, {}, ["THERE IS NO BELL HERE."]);
  if (s.bellRung) return act(s, {}, ["DING. THE NIGHT ECHOES BACK."]);
  return act(s, { bellRung: true }, ["DING.", "SOMEWHERE TO THE EAST, A DOOR THAT WAS NOT THERE CREAKS."]);
}

function search(s: NightDeskState, thing: string): NightDeskResult {
  if (s.room === "closet" && (thing === "" || thing === "SHEETS" || thing === "CLOSET")) {
    if (s.has.key) return act(s, {}, ["ONLY SHEETS NOW. ONE OF THEM SIGHS."]);
    return act(s, { has: { ...s.has, key: true } }, ["BETWEEN THE SHEETS: AN OLD BRASS KEY, TAGGED '13'.", "TAKEN."]);
  }
  if (s.room === "office" && (thing === "" || thing === "CABINET")) return act(s, {}, ["EVERY HOOK HAS A KEY EXCEPT 13. THE NIGHT MAID TIDIES THINGS INTO THE LINEN CLOSET."]);
  return act(s, {}, ["YOU FIND NOTHING BUT DUST."]);
}

function open(s: NightDeskState, thing: string): NightDeskResult {
  if (s.room !== "corridor" || (thing !== "" && thing !== "DOOR" && thing !== "DOOR 13" && thing !== "13")) {
    return act(s, {}, ["THERE IS NOTHING HERE TO OPEN."]);
  }
  if (!s.bellRung) return act(s, {}, ["DOORS 11, 12 AND 14 ARE OCCUPIED. BY SOMETHING. BETTER NOT."]);
  if (s.doorOpen) return act(s, {}, ["DOOR 13 IS ALREADY OPEN."]);
  if (!s.has.key) return act(s, {}, ["DOOR 13 IS LOCKED. THE KEY BELONGS ON HOOK 13 IN THE BACK OFFICE."]);
  return act(s, { doorOpen: true }, ["THE BRASS KEY TURNS. DOOR 13 SWINGS OPEN TO THE EAST."]);
}

function sign(s: NightDeskState, thing: string): NightDeskResult {
  if (thing !== "" && thing !== "LEDGER" && thing !== "OUT") return act(s, {}, ["YOU CAN'T SIGN THAT."]);
  if (!s.has.ledger) return act(s, {}, ["YOU HAVE NOTHING TO SIGN."]);
  if (s.room !== "room13" || s.done) return act(s, {}, ["NOBODY HERE IS WAITING TO CHECK OUT."]);
  const moves = s.moves + 1;
  return {
    state: { ...s, done: true, moves },
    lines: [
      "YOU WRITE THE DATE IN THE 'OUT' COLUMN.",
      'MR. HOLLOW SMILES. "AT LAST. THANK YOU, CLERK."',
      "HE FADES LIKE BREATH ON A WINDOW.",
      "",
      "*** CHECKOUT COMPLETE ***",
      `YOU SOLVED THE NIGHT DESK IN ${moves} MOVES.`,
      "THANK YOU FOR STAYING AT THE GHOSTEL.",
      "TYPE RESTART TO PLAY AGAIN, OR EXIT.",
    ],
  };
}

function inventory(s: NightDeskState): string[] {
  const items = [...(s.has.ledger ? ["A COLD LEATHER LEDGER"] : []), ...(s.has.key ? ["A BRASS KEY TAGGED '13'"] : [])];
  return items.length ? ["YOU ARE CARRYING:", ...items.map((i) => `  ${i}`)] : ["YOU ARE CARRYING NOTHING BUT A FLASHLIGHT."];
}

function who(ctx: NightDeskContext): string[] {
  const names = ctx.guests.slice(0, 20).map((n) => `  ${normalizeCommand(n) ?? ""}`);
  return [`GUESTS IN THE LOBBY: ${ctx.guests.length}`, ...names];
}

function rooms(ctx: NightDeskContext): string[] {
  if (ctx.doors.length === 0) return ["NO ROOM DOORS ON THIS FLOOR."];
  return ["ROOM REGISTER:", ...ctx.doors.map((d) => `  ${d.code}  ${d.name === null ? "VACANT" : (normalizeCommand(d.name) ?? "")}`)];
}

/** One command. Meta commands (HELP, LOOK, WHO, ROOMS, INVENTORY, CLEAR) do not count as moves. */
export function nightDeskStep(state: NightDeskState, raw: unknown, ctx: NightDeskContext): NightDeskResult {
  const input = normalizeCommand(raw);
  if (input === null) return { state, lines: [`LINE TOO LONG (MAX ${NIGHT_DESK_INPUT_MAX} CHARACTERS).`] };
  if (input === "") return { state, lines: [] };
  const [verb = "", ...rest] = input.split(" ");
  const thing = rest
    .filter((w) => w !== "THE" && w !== "A" && w !== "AN")
    .join(" ");

  const dir = DIRECTIONS[verb] ?? (verb === "GO" || verb === "WALK" ? DIRECTIONS[thing] : undefined);
  if (dir) return go(state, dir);
  switch (verb) {
    case "HELP":
    case "?":
      return { state, lines: HELP };
    case "LOOK":
    case "L":
      return { state, lines: describe(state) };
    case "INVENTORY":
    case "INV":
    case "I":
      return { state, lines: inventory(state) };
    case "WHO":
      return { state, lines: who(ctx) };
    case "ROOMS":
      return { state, lines: rooms(ctx) };
    case "CLEAR":
    case "CLS":
      return { state, lines: describe(state), clear: true };
    case "RESTART": {
      const fresh = startNightDesk();
      return { ...fresh, clear: true };
    }
    case "EXIT":
    case "QUIT":
    case "BYE":
    case "LOGOUT":
      return { state, lines: ["GOODNIGHT, CLERK."], exit: true };
    case "TAKE":
    case "GET":
      return take(state, thing);
    case "READ":
      return read(state, thing);
    case "RING":
      return ring(state, thing);
    case "SEARCH":
      return search(state, thing);
    case "OPEN":
    case "UNLOCK":
      return open(state, thing);
    case "SIGN":
      return sign(state, thing);
    case "XYZZY":
      return { state, lines: ["A HOLLOW VOICE SAYS: 'WRONG CAVE. THIS IS A HOTEL.'"] };
    case "GO":
    case "WALK":
      return { state, lines: ["GO WHERE? NORTH, SOUTH, EAST OR WEST."] };
    default:
      return { state, lines: [`I DON'T KNOW THE WORD "${verb.slice(0, 16)}".`] };
  }
}
