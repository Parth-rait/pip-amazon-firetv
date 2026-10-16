// The decision router for text: known commands go to deterministic handlers, never to a model.
// Questions are tagged with a topic so retrieval can answer the common ones directly.
import { LIMITS } from '../../shared/protocol.js';

export type PlaybackIntent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; deltaSec: number };

export type QuestionTopic = 'recap' | 'identify' | 'why' | 'other';

export type TextRoute =
  | { kind: 'action'; intent: PlaybackIntent }
  | { kind: 'dismiss' }
  | { kind: 'ambiguous-command'; options: string[] } // fail closed: offer explicit choices
  | { kind: 'question'; topic: QuestionTopic };

const DEFAULT_SEEK_SEC = 10;
const POLITE = /^(?:(?:hey|ok|okay) pip[, ]*)?(?:please |can you |could you )?(.*?)(?: please| pip)?[.!?]*$/;
const FILM = '(?: the (?:film|movie|video|show))?';
const PAUSE = new RegExp(`^(?:pause|hold on|wait)${FILM}$`);
const PLAY = new RegExp(`^(?:play|resume|continue|unpause|keep (?:playing|going)|start)${FILM}(?: again)?$`);
const SEEK = /^(?:go |skip |jump |move )?(back|backwards?|rewind|forward|forwards|ahead|fast forward)(?: by)?(?: (\d{1,3}) ?(s|sec|secs|seconds?|min|mins|minutes?))?$/;
const DISMISS = /^(?:never ?mind|close|hide(?: pip)?|dismiss|go away|done|thats all|that is all|thanks?(?: you)?|ok thanks)$/;
const AMBIGUOUS_STOP = /^stop$/;

/** Lowercase, no apostrophes, single spaces, without "please" and "hey Pip". */
function normalize(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}?.! ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (POLITE.exec(base)?.[1] ?? base).trim();
}

function seekIntent(direction: string, amount?: string, unit?: string): PlaybackIntent {
  const raw = amount ? Number(amount) * (unit?.startsWith('m') ? 60 : 1) : DEFAULT_SEEK_SEC;
  const magnitude = Math.min(Math.max(raw, 1), LIMITS.seekMaxAbsSec);
  const isBack = direction.startsWith('back') || direction === 'rewind';
  return { type: 'seek', deltaSec: isBack ? -magnitude : magnitude };
}

/** Where a typed or spoken request goes. Pure and deterministic. */
export function routeText(text: string): TextRoute {
  const t = normalize(text);
  if (PAUSE.test(t)) return { kind: 'action', intent: { type: 'pause' } };
  if (PLAY.test(t)) return { kind: 'action', intent: { type: 'play' } };
  const seek = SEEK.exec(t);
  if (seek) return { kind: 'action', intent: seekIntent(seek[1] ?? '', seek[2], seek[3]) };
  if (DISMISS.test(t)) return { kind: 'dismiss' };
  if (AMBIGUOUS_STOP.test(t)) return { kind: 'ambiguous-command', options: ['Pause the film', 'Hide Pip'] };
  return { kind: 'question', topic: questionTopic(t) };
}

function questionTopic(t: string): QuestionTopic {
  if (/\b(what (just )?happen|what did (i|we) miss|recap|so far|catch me up)/.test(t)) return 'recap';
  if (/^(who|whos|which (one|character|animal))\b/.test(t)) return 'identify';
  if (/^why\b/.test(t)) return 'why';
  return 'other';
}
