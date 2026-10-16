// Remembers recent event and command ids so a repeated delivery (a double tap, a retry after a
// reconnect) is applied once. Bounded, so a long session cannot grow it without limit.

export interface SeenIds {
  /** Records the id; returns false when it was already seen. */
  firstTime(id: string): boolean;
  size(): number;
}

export function createSeenIds(maxIds: number): SeenIds {
  const ids = new Set<string>();
  return {
    firstTime(id) {
      if (ids.has(id)) return false;
      ids.add(id);
      if (ids.size > maxIds) {
        const oldest = ids.values().next().value;
        if (oldest !== undefined) ids.delete(oldest);
      }
      return true;
    },
    size: () => ids.size,
  };
}
