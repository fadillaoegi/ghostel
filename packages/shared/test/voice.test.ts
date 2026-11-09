import { describe, expect, it } from "vitest";
import { ICE_MAX, SDP_MAX, iceServersSchema, parseClientMessage } from "../src/index";

const offer = (sdp: string) => JSON.stringify({ t: "signal", to: "abc", data: { kind: "offer", sdp } });

describe("call protocol", () => {
  it("parses seats and media state", () => {
    expect(parseClientMessage('{"t":"sit","table":"t3","seat":1}')).toEqual({ ok: true, msg: { t: "sit", table: "t3", seat: 1 } });
    expect(parseClientMessage('{"t":"sit","table":"t3","seat":8}')).toEqual({ ok: false, reason: "bad_shape" });
    expect(parseClientMessage('{"t":"stand"}')).toEqual({ ok: true, msg: { t: "stand" } });
    const media = { t: "media", mic: true, cam: "{0b1c2d3e-aaaa-bbbb-cccc-1234567890ab}", screen: null };
    expect(parseClientMessage(JSON.stringify(media))).toEqual({ ok: true, msg: media });
    expect(parseClientMessage(JSON.stringify({ ...media, cam: "<script>" }))).toEqual({ ok: false, reason: "bad_shape" });
    expect(parseClientMessage(JSON.stringify({ ...media, mic: "yes" }))).toEqual({ ok: false, reason: "bad_shape" });
    expect(parseClientMessage('{"t":"voice_join"}')).toEqual({ ok: false, reason: "bad_shape" });
  });

  it("parses offers, answers and ICE candidates", () => {
    expect(parseClientMessage(offer("v=0\r\n"))).toMatchObject({ ok: true });
    const ice = { t: "signal", to: "abc", data: { kind: "ice", candidate: "candidate:1 1 udp 1 127.0.0.1 5000 typ host", sdpMid: "0", sdpMLineIndex: 0 } };
    expect(parseClientMessage(JSON.stringify(ice))).toMatchObject({ ok: true });
    const endOfCandidates = { ...ice, data: { kind: "ice", candidate: "", sdpMid: null, sdpMLineIndex: null } };
    expect(parseClientMessage(JSON.stringify(endOfCandidates))).toMatchObject({ ok: true });
  });

  it("enforces signal size limits", () => {
    expect(parseClientMessage(offer("x".repeat(SDP_MAX)))).toMatchObject({ ok: true });
    expect(parseClientMessage(offer("x".repeat(SDP_MAX + 1)))).toEqual({ ok: false, reason: "bad_shape" });
    const ice = { t: "signal", to: "abc", data: { kind: "ice", candidate: "c".repeat(ICE_MAX + 1), sdpMid: "0", sdpMLineIndex: 0 } };
    expect(parseClientMessage(JSON.stringify(ice))).toEqual({ ok: false, reason: "bad_shape" });
  });

  it("does not let clients pick the sender or smuggle fields", () => {
    expect(parseClientMessage(JSON.stringify({ t: "signal", to: "abc", from: "victim", data: { kind: "offer", sdp: "v=0" } }))).toEqual({
      ok: false,
      reason: "bad_shape",
    });
    expect(parseClientMessage(JSON.stringify({ t: "signal", to: "abc", data: { kind: "offer", sdp: "v=0", extra: 1 } }))).toEqual({
      ok: false,
      reason: "bad_shape",
    });
    expect(parseClientMessage(JSON.stringify({ t: "signal", to: "x".repeat(33), data: { kind: "answer", sdp: "v=0" } }))).toEqual({
      ok: false,
      reason: "bad_shape",
    });
  });
});

describe("ICE server config", () => {
  it("accepts STUN and TURN entries", () => {
    expect(iceServersSchema.safeParse([{ urls: "stun:stun.l.google.com:19302" }]).success).toBe(true);
    expect(iceServersSchema.safeParse([{ urls: ["turn:turn.example.com:3478"], username: "u", credential: "p" }]).success).toBe(true);
  });

  it("rejects junk", () => {
    expect(iceServersSchema.safeParse([{ url: "stun:x" }]).success).toBe(false);
    expect(iceServersSchema.safeParse("stun:x").success).toBe(false);
  });
});
