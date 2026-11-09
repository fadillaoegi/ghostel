import { describe, expect, it } from "vitest";
import {
  ROOM_LAYOUT,
  PLAYER_RADIUS,
  constrainToWorld,
  initialMoveState,
  isRoomId,
  parseClientMessage,
  parseRoomInput,
  resolveMove,
  validateRoomName,
  validateRoomPassword,
} from "../src/index";

const base = { name: "Pumpkin Patch", access: "open", decor: "crypt", game: "pumpkin_trivia" };

describe("validateRoomName", () => {
  it("accepts and normalises friendly names", () => {
    expect(validateRoomName("  Count's   Crypt!  ")).toEqual({ ok: true, value: "Count's Crypt!" });
    expect(validateRoomName("Ruang Hantu 13")).toEqual({ ok: true, value: "Ruang Hantu 13" });
  });

  it("rejects bad names with clear messages", () => {
    expect(validateRoomName("ab")).toEqual({ ok: false, message: "Room names need at least 3 characters." });
    expect(validateRoomName("a".repeat(31))).toEqual({ ok: false, message: "Room names can be at most 30 characters." });
    expect(validateRoomName("<script>").ok).toBe(false);
    expect(validateRoomName("   ")).toEqual({ ok: false, message: "Give your room a name." });
    expect(validateRoomName(7)).toEqual({ ok: false, message: "Give your room a name." });
  });
});

describe("validateRoomPassword", () => {
  it("keeps passwords exactly as typed (no trimming)", () => {
    expect(validateRoomPassword(" boo ")).toEqual({ ok: true, value: " boo " });
    expect(validateRoomPassword("kürbis🎃")).toEqual({ ok: true, value: "kürbis🎃" });
  });

  it("enforces length and printable characters", () => {
    expect(validateRoomPassword("abc")).toEqual({ ok: false, message: "Passwords need at least 4 characters." });
    expect(validateRoomPassword("a".repeat(65))).toEqual({ ok: false, message: "Passwords can be at most 64 characters." });
    expect(validateRoomPassword("abc\u0000d")).toEqual({ ok: false, message: "Passwords cannot contain control characters." });
    expect(validateRoomPassword("")).toEqual({ ok: false, message: "Enter a password." });
  });
});

describe("parseRoomInput", () => {
  it("parses a full create body", () => {
    expect(parseRoomInput(base, "create")).toEqual({ ok: true, value: base });
  });

  it("requires a password for password rooms on create", () => {
    expect(parseRoomInput({ ...base, access: "password" }, "create")).toEqual({
      ok: false,
      field: "password",
      message: "Set a password for this room.",
    });
    expect(parseRoomInput({ ...base, access: "password", password: "secret" }, "create")).toMatchObject({ ok: true });
  });

  it("rejects passwords on rooms that are not password protected", () => {
    expect(parseRoomInput({ ...base, password: "secret" }, "create")).toMatchObject({ ok: false, field: "password" });
  });

  it("rejects unknown fields and enum values", () => {
    expect(parseRoomInput({ ...base, owner: "someone" }, "create")).toMatchObject({ ok: false, field: "owner" });
    expect(parseRoomInput({ ...base, password_hash: "x" }, "create")).toMatchObject({ ok: false, field: "password_hash" });
    expect(parseRoomInput({ ...base, decor: "space" }, "create")).toMatchObject({ ok: false, field: "decor" });
    expect(parseRoomInput({ ...base, access: "public" }, "create")).toMatchObject({ ok: false, field: "access" });
  });

  it("allows partial updates", () => {
    expect(parseRoomInput({ access: "locked" }, "update")).toEqual({ ok: true, value: { access: "locked" } });
    expect(parseRoomInput({}, "update")).toEqual({ ok: true, value: {} });
    expect(parseRoomInput({ password: "newpass" }, "update")).toEqual({ ok: true, value: { password: "newpass" } });
    expect(parseRoomInput({ name: "x" }, "update")).toMatchObject({ ok: false, field: "name" });
  });
});

describe("room ids and protocol", () => {
  it("recognises UUIDs only", () => {
    expect(isRoomId("3f2b8c1e-9d4a-4c7e-8b1f-2a6d5e9c0b7a")).toBe(true);
    expect(isRoomId("1; DROP TABLE rooms")).toBe(false);
    expect(isRoomId(42)).toBe(false);
  });

  it("parses enter and exit", () => {
    expect(parseClientMessage('{"t":"enter","room":"abc","password":"x"}')).toMatchObject({ ok: true });
    expect(parseClientMessage('{"t":"exit"}')).toEqual({ ok: true, msg: { t: "exit" } });
    expect(parseClientMessage('{"t":"enter","room":"abc","owner":true}')).toEqual({ ok: false, reason: "bad_shape" });
  });
});

describe("room layout", () => {
  it("keeps players inside the room and off the table", () => {
    for (let x = -12; x <= 12; x += 0.53) {
      for (let z = -9; z <= 9; z += 0.47) {
        const p = constrainToWorld({ x, z }, ROOM_LAYOUT);
        expect(p.x).toBeGreaterThanOrEqual(ROOM_LAYOUT.bounds.minX + PLAYER_RADIUS - 1e-6);
        expect(p.x).toBeLessThanOrEqual(ROOM_LAYOUT.bounds.maxX - PLAYER_RADIUS + 1e-6);
        // Off the long table (a box) in every room size.
        const box = ROOM_LAYOUT.obstacles.find((o) => o.label === "table");
        if (box?.kind !== "box") throw new Error("rooms have a long table");
        const gap = Math.hypot(Math.max(box.minX - p.x, 0, p.x - box.maxX), Math.max(box.minZ - p.z, 0, p.z - box.maxZ));
        expect(gap).toBeGreaterThanOrEqual(PLAYER_RADIUS - 1e-6);
      }
    }
  });

  it("room spawn points are walkable", () => {
    for (let i = 0; i <= 10; i++) {
      const p = ROOM_LAYOUT.spawn(() => i / 10);
      expect(constrainToWorld(p, ROOM_LAYOUT)).toEqual(p);
    }
  });

  it("resolveMove uses the given layout", () => {
    const r = resolveMove(initialMoveState({ x: 7, z: 0 }), { x: 9, z: 0 }, 1, ROOM_LAYOUT);
    expect(r.pos.x).toBeCloseTo(8 - PLAYER_RADIUS);
    expect(r.corrected).toBe(true);
  });
});
