// "While you were away" for the film night: where each viewer left the film, and on their return
// (or a late join) the facts they missed, for their pad only. The film and the room carry on.
import { LATE_JOIN_MIN_SEC, missedFacts } from './core/context/missed.js';
import { positionNow, type FlowDeps } from './flow.js';
import type { Session } from './sessions.js';
import type { PipMissed } from './shared/protocol.js';

/** Remembers where the film was when this viewer stopped watching; the first time counts. */
export function markAway(session: Session, playerId: string, deps: FlowDeps): void {
  if (session.stage !== 'watch' || session.away[playerId]) return;
  const now = positionNow(session, deps);
  if (!now) return;
  session.away[playerId] = { contentId: now.film.id, atSec: now.positionSec };
}

/**
 * What this viewer missed, or null when there is nothing worth a card: not watching, another
 * film, a short gap, or no reviewed facts in it. Clears the away mark either way.
 */
export function catchUp(
  session: Session,
  playerId: string,
  deps: FlowDeps,
  lateJoin = false,
): PipMissed | null {
  const left = session.away[playerId];
  delete session.away[playerId];
  const now = positionNow(session, deps);
  if (session.stage !== 'watch' || !now) return null;
  const fromSec = lateJoin ? 0 : left?.contentId === now.film.id ? left.atSec : null;
  if (fromSec === null) return null;
  if (lateJoin && now.positionSec < LATE_JOIN_MIN_SEC) return null;
  const timeline = deps.timelines?.get(now.film.id);
  if (!timeline) return null;
  const facts = missedFacts(timeline, deps.timelinePolicy ?? 'accepted', fromSec, now.positionSec);
  if (facts.length === 0) return null;
  deps.journal?.record({
    session_id: session.journalId,
    playerId,
    event_type: 'pip.missed',
    content_id: now.film.id,
    source: 'system',
    data: {
      fromSec: Math.round(fromSec),
      toSec: Math.round(now.positionSec),
      lateJoin,
      facts: facts.map((f) => f.id).join(' '),
    },
    provenance: 'system',
  });
  return {
    contentId: now.film.id,
    fromSec,
    toSec: now.positionSec,
    lateJoin,
    // A beat that began just before they left is shown at the moment they left.
    items: facts.map((f) => ({ atSec: Math.max(f.startSec, fromSec), text: f.text })),
  };
}
