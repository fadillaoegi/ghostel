import { describe, expect, it } from "vitest";
import { MAX_CLIENT_FRAME_BYTES, parseClientMessage } from "../src/index";

describe("parseClientMessage", () => {
  it("parses a move", () => {
    expect(parseClientMessage('{"t":"move","x":1.5,"z":-2,"ry":0.3}')).toEqual({
      ok: true,
      msg: { t: "move", x: 1.5, z: -2, ry: 0.3 },
    });
  });

  it("rejects invalid JSON", () => {
    expect(parseClientMessage("{nope")).toEqual({ ok: false, reason: "bad_json" });
  });

  it("rejects unknown types, extra keys and wrong field types", () => {
    for (const raw of [
      '{"t":"teleport","x":1,"z":1}',
      '{"t":"move","x":1,"z":1,"ry":0,"admin":true}',
      '{"t":"move","x":"1","z":1,"ry":0}',
      '{"t":"move","x":1,"z":1}',
      "[]",
      "null",
    ]) {
      expect(parseClientMessage(raw)).toEqual({ ok: false, reason: "bad_shape" });
    }
  });

  it("rejects Infinity smuggled through JSON exponents", () => {
    expect(JSON.parse("1e999")).toBe(Number.POSITIVE_INFINITY);
    expect(parseClientMessage('{"t":"move","x":1e999,"z":0,"ry":0}')).toEqual({ ok: false, reason: "bad_shape" });
  });

  it("rejects oversized frames before parsing", () => {
    const raw = JSON.stringify({ t: "move", x: 0, z: 0, ry: 0, pad: "x".repeat(MAX_CLIENT_FRAME_BYTES) });
    expect(parseClientMessage(raw)).toEqual({ ok: false, reason: "too_large" });
  });
});
