// The event journal: an append-only record of what happened in a session, for diagnosis, replay
// tests and evaluation. In memory and bounded; exported as JSON Lines only when asked.

export interface JournalEvent {
  v: 1;
  seq: number; // per journal, increasing
  at: number; // server clock (ms)
  type: string; // for example "input.applied", "action.done", "ask.reply"
  source: string; // "pad", "tv", "remote", "server"
  actor: string | null; // player id; never a name
  data: Record<string, string | number | boolean | null | string[]>;
}

export interface Journal {
  append(event: Omit<JournalEvent, 'v' | 'seq'>): JournalEvent;
  events(): readonly JournalEvent[];
  toJsonl(): string;
}

/** Keeps the newest `maxEvents`. Callers must not put names or question text in `data`. */
export function createJournal(maxEvents: number): Journal {
  const list: JournalEvent[] = [];
  let seq = 0;
  return {
    append(event) {
      seq += 1;
      const full: JournalEvent = { v: 1, seq, ...event };
      list.push(full);
      if (list.length > maxEvents) list.splice(0, list.length - maxEvents);
      return full;
    },
    events: () => list,
    toJsonl: () => list.map((e) => JSON.stringify(e)).join('\n') + (list.length ? '\n' : ''),
  };
}
