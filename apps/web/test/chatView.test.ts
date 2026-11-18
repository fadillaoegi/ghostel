import { describe, expect, it } from "vitest";
import { visibleStart } from "../src/ui/chatView";

const chat = { kind: "chat" } as const;
const notice = { kind: "notice" } as const;

describe("visibleStart (M23: 15 messages in the chat panel)", () => {
  it("shows everything when there are few messages", () => {
    expect(visibleStart([], 15)).toBe(0);
    expect(visibleStart([notice, chat, chat], 15)).toBe(0);
  });

  it("starts at the count-th message from the end; notices do not count", () => {
    const lines = [chat, chat, notice, chat, notice, chat, chat];
    expect(visibleStart(lines, 3)).toBe(3);
    expect(visibleStart(lines, 1)).toBe(6);
    expect(visibleStart(lines, 5)).toBe(0);
  });

  it("hides notices older than the oldest visible message", () => {
    const lines = [chat, notice, notice, chat, chat];
    expect(visibleStart(lines, 2)).toBe(3);
  });

  it("with 40 messages and a page of 15, shows the newest 15", () => {
    const lines = Array.from({ length: 40 }, () => chat);
    expect(lines.slice(visibleStart(lines, 15))).toHaveLength(15);
    expect(lines.slice(visibleStart(lines, 30))).toHaveLength(30);
  });
});
