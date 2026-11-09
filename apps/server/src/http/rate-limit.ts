/** Fixed-window in-memory rate limiter keyed by an arbitrary string (e.g. client IP). */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns true when the call is allowed. */
  take(key: string): boolean {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || t - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: t });
      this.prune(t);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  private prune(t: number): void {
    if (this.hits.size < 10_000) return;
    for (const [key, entry] of this.hits) if (t - entry.windowStart >= this.windowMs) this.hits.delete(key);
  }
}
