/**
 * Minimal in-process rate limiter — a fixed-size Map of sliding-window hit
 * timestamps, evicting the oldest key when full.
 *
 * ⚠️ Known trade-off: state lives in one server instance's memory. Across
 * several instances the count is per-instance, so the effective limit is
 * (limit × instances) and a restart clears it. That is deliberate: it stops
 * password brute-forcing (which needs thousands of tries) without adding Redis
 * as a dependency. If we ever need exact limits, swap the body of `hit()` for
 * Upstash Redis — the call sites don't change.
 */

const MAX_TRACKED_KEYS = 5_000;

type Window = number[]; // hit timestamps (ms), oldest first

const windows = new Map<string, Window>();

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the next attempt is allowed. 0 when `ok`. */
  retryAfter: number;
};

/**
 * Record one attempt against `key` and report whether it's allowed.
 *
 * Call this BEFORE doing the work, then call `reset(key)` once the attempt
 * succeeds — that way only runs of failures accumulate, and a legitimate user
 * who mistypes twice before getting in starts clean again.
 */
export function hit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const recent = (windows.get(key) ?? []).filter((at) => at > cutoff);

  if (recent.length >= limit) {
    // Refuse without recording, so a client hammering the endpoint can't keep
    // pushing its own window forward and extend the lockout indefinitely.
    windows.set(key, recent);
    const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
    return { ok: false, retryAfter: Math.max(retryAfter, 1) };
  }

  recent.push(now);

  // Bound memory: drop the least-recently-touched key. Map preserves insertion
  // order and we re-insert on every hit, so the first key is the stalest.
  if (!windows.has(key) && windows.size >= MAX_TRACKED_KEYS) {
    const oldest = windows.keys().next().value;
    if (oldest !== undefined) windows.delete(oldest);
  }
  windows.delete(key);
  windows.set(key, recent);

  return { ok: true, retryAfter: 0 };
}

/** Clear a key's window — call after a successful attempt. */
export function reset(key: string): void {
  windows.delete(key);
}

/** Test-only: wipe all state between cases. */
export function resetAll(): void {
  windows.clear();
}

/**
 * Best-effort client IP. Vercel sets `x-forwarded-for`; the left-most entry is
 * the original client. Falls back to a constant so the limiter degrades to
 * "per-email" rather than failing open entirely.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
