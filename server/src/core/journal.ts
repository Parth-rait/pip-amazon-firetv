// The event journal (docs/vnext/PLAN.md 6.1): what happened, append-only, one JSON line per event.
// Writes are queued and never awaited by the caller, so the journal can never block playback.
// Subjects are pseudonymous (a hash of the player id); names and question text are never stored.
import { createHash, randomBytes } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const JOURNAL_SCHEMA_VERSION = 1;

export interface JournalEvent {
  schema_version: number;
  event_id: string;
  session_id: string;
  subject_id: string | null;
  timestamp_utc: string;
  event_type: string; // for example media.playPause, pip.invoke, action.confirmed
  content_id: string | null;
  source: string; // the input adapter or the component that observed it
  data: Record<string, string | number | boolean | null>; // small, non-personal fields only
  consent_scope: 'pilot_operational';
  provenance: { kind: 'direct_observation' | 'system' };
}

export type JournalInput = Omit<
  JournalEvent,
  'schema_version' | 'event_id' | 'timestamp_utc' | 'consent_scope' | 'provenance' | 'subject_id'
> & {
  playerId?: string | null;
  provenance?: JournalEvent['provenance']['kind'];
};

export interface Journal {
  record(event: JournalInput): void;
  /** Resolves when every queued write has finished (for tests and shutdown). */
  flush(): Promise<void>;
}

/** A stable pseudonym for a player id: the same player gets the same subject id, never the raw id. */
export function pseudonym(playerId: string): string {
  return `subj_${createHash('sha256').update(`pip:${playerId}`).digest('hex').slice(0, 16)}`;
}

function toEvent(input: JournalInput, nowMs: number): JournalEvent {
  const { playerId, provenance, ...rest } = input;
  return {
    schema_version: JOURNAL_SCHEMA_VERSION,
    event_id: `evt_${randomBytes(8).toString('hex')}`,
    timestamp_utc: new Date(nowMs).toISOString(),
    subject_id: playerId ? pseudonym(playerId) : null,
    consent_scope: 'pilot_operational',
    provenance: { kind: provenance ?? 'direct_observation' },
    ...rest,
  };
}

/** A journal that appends to <dir>/events-YYYY-MM-DD.jsonl. Write errors go to onError only. */
export function createFileJournal(options: {
  dir: string;
  now: () => number;
  onError?: (error: unknown) => void;
}): Journal {
  let queue: Promise<void> = mkdir(options.dir, { recursive: true }).then(
    () => undefined,
    (error: unknown) => options.onError?.(error),
  );
  return {
    record(input) {
      const event = toEvent(input, options.now());
      const file = join(options.dir, `events-${event.timestamp_utc.slice(0, 10)}.jsonl`);
      queue = queue
        .then(() => appendFile(file, `${JSON.stringify(event)}\n`))
        .catch((error: unknown) => options.onError?.(error));
    },
    flush: () => queue,
  };
}

/** A journal kept in memory, for tests. */
export function createMemoryJournal(now: () => number): Journal & { events: JournalEvent[] } {
  const events: JournalEvent[] = [];
  return {
    events,
    record(input) {
      events.push(toEvent(input, now()));
    },
    flush: () => Promise.resolve(),
  };
}
