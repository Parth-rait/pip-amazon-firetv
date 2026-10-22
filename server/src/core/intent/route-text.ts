// The decision router for text: known commands go to deterministic handlers, never to a model.
// Questions are tagged with a topic so retrieval can answer the common ones directly.
import { LIMITS } from '../../shared/protocol.js';

export type PlaybackIntent =
  { type: 'play' } | { type: 'pause' } | { type: 'seek'; deltaSec: number };

// 'future' asks what happens later: Pip never predicts, so it answers with a fixed line.
// 'imagine' asks Pip to make up another version ("What if she stayed home?", "a better ending").
export type QuestionTopic = 'recap' | 'identify' | 'why' | 'future' | 'imagine' | 'other';

export type TextRoute =
  | { kind: 'action'; intent: PlaybackIntent }
  | { kind: 'dismiss' }
  | { kind: 'ambiguous-command'; options: string[] } // fail closed: offer explicit choices
  | { kind: 'question'; topic: QuestionTopic };

const DEFAULT_SEEK_SEC = 10;
const POLITE =
  /^(?:(?:hey|ok|okay) pip[, ]*)?(?:please |can you |could you )?(.*?)(?: please| pip)?[.!?]*$/;
const FILM = '(?: the (?:film|movie|video|show))?';
const PAUSE = new RegExp(`^(?:pause|hold on|wait)${FILM}$`);
const PLAY = new RegExp(
  `^(?:play|resume|continue|unpause|keep (?:playing|going)|start)${FILM}(?: again)?$`,
);
const SEEK =
  /^(?:go |skip |jump |move )?(back|backwards?|rewind|forward|forwards|ahead|fast forward)(?: by)?(?: (\d{1,3}) ?(s|sec|secs|seconds?|min|mins|minutes?))?$/;
const DISMISS =
  /^(?:never ?mind|close|hide(?: pip)?|dismiss|go away|done|thats all|that is all|thanks?(?: you)?|ok thanks)$/;
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
  if (AMBIGUOUS_STOP.test(t))
    return { kind: 'ambiguous-command', options: ['Pause the film', 'Hide Pip'] };
  return { kind: 'question', topic: questionTopic(t) };
}

const FUTURE =
  /\b(next|later|going to|gonna|ending|in the end|at the end|end up)\b|\bhow does (it|this|the \w+) end\b|\bwill\b|\bever\b/;

// "Does she find the dragon?", "Is Scales still alive?": yes or no about how things turn out. Either
// answer would tell the story ahead, so these are questions about the future too. "Did" asks the past.
const OUTCOME =
  /^(does|do|is|are|can) .*\b(get (hurt|caught|away|killed|eaten|saved)|grows? up|die|dies|survive|escape|win|lose|finds?|come back|make it|revenge|fight back|still alive|alive)\b/;

const IMAGINE =
  /^(what if|imagine|suppose|pretend)\b|\b(better|different|happier|happy|new|alternate|alternative|another|funnier) ending\b|\bwent differently\b|\b(rewrite|retell|change) (the|this|it|that)\b/;

function questionTopic(t: string): QuestionTopic {
  if (IMAGINE.test(t)) return 'imagine';
  if (FUTURE.test(t) && !/\b(what (just )?happened|before)\b/.test(t)) return 'future';
  if (OUTCOME.test(t)) return 'future';
  if (/\b(what (just )?happened|what did (i|we) miss|recap|so far|catch me up)\b/.test(t))
    return 'recap';
  // "Who is that?" or "Who is Hoot?" identify someone; "Who owns the lantern?" asks a relation.
  // "Who is she looking for?" asks about what someone does, not who they are.
  if (/^(who is|who are|whos) \w+ \w+ing\b/.test(t)) return 'other';
  if (/^(who is|who are|whos|which (one|character|animal))\b/.test(t)) return 'identify';
  if (/^why\b/.test(t)) return 'why';
  return 'other';
}
