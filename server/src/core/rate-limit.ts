// A sliding-window counter per key, used for the join limit (PROJECT.md section 4.8).

export interface RateLimit {
  isLimited(key: string, nowMs: number): boolean;
  record(key: string, nowMs: number): void;
}

export function createRateLimit(max: number, windowMs: number): RateLimit {
  const events = new Map<string, number[]>();

  function recent(key: string, nowMs: number): number[] {
    const kept = (events.get(key) ?? []).filter((at) => nowMs - at < windowMs);
    if (kept.length > 0) events.set(key, kept);
    else events.delete(key);
    return kept;
  }

  return {
    isLimited: (key, nowMs) => recent(key, nowMs).length >= max,
    record(key, nowMs) {
      events.set(key, [...recent(key, nowMs), nowMs]);
    },
  };
}
