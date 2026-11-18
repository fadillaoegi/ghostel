/**
 * Index of the first chat line to show so that exactly `count` chat messages are visible (M23), plus the
 * notices ("arrived", "left") between and after them. Notices older than the oldest visible message are hidden.
 * Returns 0 when there are `count` or fewer messages.
 */
export function visibleStart(lines: readonly { kind: "chat" | "notice" }[], count: number): number {
  let seen = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]?.kind !== "chat") continue;
    seen += 1;
    if (seen === count) return i;
  }
  return 0;
}
