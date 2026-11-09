import { describe, expect, it } from "vitest";
import { CHAT_MAX, normalizeChat, parseClientMessage, validateChat } from "../src/index";

describe("normalizeChat", () => {
  it("collapses whitespace and newlines into single spaces", () => {
    expect(normalizeChat("  boo\n\n\tare   you  there?  ")).toBe("boo are you there?");
  });

  it("removes control characters", () => {
    expect(normalizeChat("bo\u0000o\u0007!\u007f")).toBe("boo!");
  });

  it("removes bidirectional overrides and BOM that could spoof text", () => {
    expect(normalizeChat("\u202Egnp.exe\u202C")).toBe("gnp.exe");
    expect(normalizeChat("a\u2066b\u2069c\u200Fd\uFEFF")).toBe("abcd");
  });

  it("caps stacked combining marks (zalgo)", () => {
    const zalgo = "h" + "\u0301\u0302\u0303\u0304\u0305\u0306" + "i";
    expect(normalizeChat(zalgo)).toBe("h\u0301\u0302i");
  });

  it("keeps emoji, accents and non-Latin scripts", () => {
    expect(normalizeChat("Selamat malam 👻 ¿qué tal? 幽霊")).toBe("Selamat malam 👻 ¿qué tal? 幽霊");
    expect(normalizeChat("👨‍👩‍👧")).toBe("👨‍👩‍👧");
  });
});

describe("validateChat", () => {
  it("accepts a normal message", () => {
    expect(validateChat("  Happy Kiroween! ")).toEqual({ ok: true, value: "Happy Kiroween!" });
  });

  it("rejects empty and whitespace-only messages", () => {
    for (const raw of ["", "   ", "\n\t", "\u202E\u202C", undefined, 42]) {
      expect(validateChat(raw)).toEqual({ ok: false, message: "Type a message first." });
    }
  });

  it("limits length by characters after normalising", () => {
    expect(validateChat("a".repeat(CHAT_MAX)).ok).toBe(true);
    expect(validateChat("👻".repeat(CHAT_MAX)).ok).toBe(true);
    expect(validateChat("a".repeat(CHAT_MAX + 1))).toEqual({ ok: false, message: "Messages can be at most 200 characters." });
    expect(validateChat(`${"a ".repeat(150)}`).ok).toBe(false);
    expect(validateChat(`a${" ".repeat(500)}b`)).toEqual({ ok: true, value: "a b" });
  });
});

describe("chat protocol", () => {
  it("parses a chat message", () => {
    expect(parseClientMessage('{"t":"chat","text":"boo"}')).toEqual({ ok: true, msg: { t: "chat", text: "boo" } });
  });

  it("rejects chat with a forged sender or wrong types", () => {
    expect(parseClientMessage('{"t":"chat","text":"hi","from":"someone-else"}')).toEqual({ ok: false, reason: "bad_shape" });
    expect(parseClientMessage('{"t":"chat","text":42}')).toEqual({ ok: false, reason: "bad_shape" });
    expect(parseClientMessage('{"t":"chat","text":"<b>x</b>","name":"Admin"}')).toEqual({ ok: false, reason: "bad_shape" });
  });
});
