// "While you were away": the facts one viewer missed, from where they left to where the film is
// now. Built on the spoiler boundary, so nothing after `toSec` can be in it, and on reviewed facts
// only, so a recap needs no model call and says nothing the film has not shown.
import { permittedEvidence } from './boundary.js';
import type { ReviewPolicy, TimedFact, Timeline } from './timeline.js';

/** Shorter gaps are not worth a card: a glance at the screen catches them up. */
export const MISSED_MIN_SEC = 20;
/** A late joiner gets the story so far only once there is a story to tell. */
export const LATE_JOIN_MIN_SEC = 60;
export const MISSED_MAX_ITEMS = 4;

/**
 * Facts revealed after `fromSec` and by `toSec`, at most `max`, spread evenly over the gap and
 * always ending with the latest, in story order.
 */
export function missedFacts(
  timeline: Timeline,
  policy: ReviewPolicy,
  fromSec: number,
  toSec: number,
  max = MISSED_MAX_ITEMS,
): TimedFact[] {
  if (toSec - fromSec < MISSED_MIN_SEC) return [];
  const missed = permittedEvidence(timeline, toSec, policy).facts.filter(
    (f) => f.revealSec > fromSec,
  );
  if (missed.length <= max) return missed;
  const step = (missed.length - 1) / (max - 1);
  const picked = new Set<number>();
  for (let i = 0; i < max; i += 1) picked.add(Math.round(i * step));
  return [...picked].sort((a, b) => a - b).map((i) => missed[i] as TimedFact);
}
