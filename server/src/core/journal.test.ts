import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFileJournal, pseudonym } from './journal.js';

describe('createFileJournal', () => {
  it('appends one JSON line per event to a dated file, in order', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'pip-journal-')), 'events');
    const journal = createFileJournal({ dir, now: () => Date.UTC(2026, 9, 16, 10, 30) });
    for (const type of ['media.pause', 'media.play']) {
      journal.record({
        session_id: 'ses_test',
        playerId: 'p1',
        event_type: type,
        content_id: 'film',
        source: 'simulator',
        data: {},
      });
    }
    await journal.flush();
    expect(readdirSync(dir)).toEqual(['events-2026-10-16.jsonl']);
    const lines = readFileSync(join(dir, 'events-2026-10-16.jsonl'), 'utf8').trim().split('\n');
    expect(lines.map((l) => (JSON.parse(l) as { event_type: string }).event_type)).toEqual([
      'media.pause',
      'media.play',
    ]);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ subject_id: pseudonym('p1') });
  });

  it('never throws to the caller when the disk fails', async () => {
    const errors: unknown[] = [];
    const journal = createFileJournal({
      dir: '/dev/null/cannot-write',
      now: () => 0,
      onError: (e) => errors.push(e),
    });
    expect(() =>
      journal.record({ session_id: 's', event_type: 'x', content_id: null, source: 't', data: {} }),
    ).not.toThrow();
    await journal.flush();
    expect(errors.length).toBeGreaterThan(0);
  });
});
