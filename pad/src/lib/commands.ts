// Voice and typed commands, parsed on the pad with plain rules: "pause", "back 10", "louder",
// "dim it", "movie lights". A command never goes to a model (docs/vnext/PLAN.md 8). Anything
// that is not a command is a question for Pip.
import type { PipInputEvent } from '../shared/protocol';

const WORD_NUMBERS: Record<string, number> = {
  five: 5,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
};

function seconds(text: string, fallback: number): number {
  const digits = /(\d{1,3})/.exec(text)?.[1];
  if (digits) return Number(digits) * (/\bminute/.test(text) ? 60 : 1);
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return n;
  }
  if (/\b(a|one) minute\b/.test(text)) return 60;
  return fallback;
}

const has = (text: string, pattern: RegExp) => pattern.test(text);

/** The command in what was said or typed, or null if it is not a command. */
export function parseCommand(raw: string): PipInputEvent | null {
  const text = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  // Questions are for Pip, even when they mention a command word ("why did he stop?").
  if (/^(who|what|why|where|when|how|which|is|are|does|did|can|will)\b/.test(text)) return null;

  if (has(text, /\b(lights?|lamps?)\b/) || has(text, /\b(movie|cinema) mode\b/)) {
    if (has(text, /\b(off|out)\b/)) return { type: 'ambient.set', scene: 'off' };
    if (has(text, /\b(movie|cinema|dim|low|down)\b/))
      return { type: 'ambient.set', scene: 'movie' };
    if (has(text, /\b(on|up|bright|full)\b/)) return { type: 'ambient.set', scene: 'bright' };
  }
  if (has(text, /\b(mute|silence)\b/)) return { type: 'media.volumeDelta', delta: -1 };
  if (has(text, /\b(louder|volume up|turn it up|turn up|more volume|cant hear)\b/)) {
    return { type: 'media.volumeDelta', delta: has(text, /\b(lot|much|way)\b/) ? 0.3 : 0.1 };
  }
  if (has(text, /\b(quieter|softer|volume down|turn it down|turn down|less volume|too loud)\b/)) {
    return { type: 'media.volumeDelta', delta: has(text, /\b(lot|much|way)\b/) ? -0.3 : -0.1 };
  }
  if (has(text, /\b(brighter|too dark|more brightness)\b/)) {
    return { type: 'media.brightnessDelta', delta: 0.15 };
  }
  if (has(text, /\b(darker|dim|dimmer|too bright|less brightness)\b/)) {
    return { type: 'media.brightnessDelta', delta: -0.15 };
  }
  if (has(text, /\b(back|rewind|go back|replay|again)\b/)) {
    return { type: 'media.seekRelative', seconds: -seconds(text, 10) };
  }
  if (has(text, /\b(forward|skip|ahead|fast forward)\b/)) {
    return { type: 'media.seekRelative', seconds: seconds(text, 10) };
  }
  if (has(text, /\b(pause|stop|hold on|wait)\b/)) return { type: 'media.pause' };
  if (has(text, /\b(play|resume|continue|start|go on|unpause)\b/)) return { type: 'media.play' };
  if (/^(hey )?pip$/.test(text)) return { type: 'pip.invoke' };
  return null;
}

const MAX_TYPED_COMMAND_WORDS = 4;

/**
 * A command typed into the Ask box: the same rules, but only for short text ("pause", "back 30
 * seconds", "turn it up"). A longer typed sentence that happens to say "again" or "back" is more
 * likely a question; the server's stricter rules still catch longer commands.
 */
export function parseTypedCommand(raw: string): PipInputEvent | null {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  return words.length <= MAX_TYPED_COMMAND_WORDS ? parseCommand(raw) : null;
}

/** A short line for what a command did, for the pad's status line. */
export function describeCommand(event: PipInputEvent): string {
  switch (event.type) {
    case 'media.play':
      return 'Playing';
    case 'media.pause':
      return 'Paused';
    case 'media.playPause':
      return 'Play or pause';
    case 'media.seekRelative':
      return event.seconds < 0 ? `Back ${-event.seconds} s` : `Forward ${event.seconds} s`;
    case 'media.volumeDelta':
      return event.delta <= -1 ? 'Muted' : event.delta < 0 ? 'Quieter' : 'Louder';
    case 'media.brightnessDelta':
      return event.delta < 0 ? 'Dimmer' : 'Brighter';
    case 'ambient.set':
      return event.scene === 'movie'
        ? 'Movie lights'
        : event.scene === 'off'
          ? 'Lights off'
          : 'Lights up';
    case 'pip.invoke':
      return 'Pip is here';
    default:
      return 'Done';
  }
}

/** The server's action name ("seek -10", "volume 90%", "ambient.movie") in plain words. */
export function actionLabel(action: string): string {
  const [verb = '', arg = ''] = action.split(' ');
  switch (verb) {
    case 'play':
      return 'Playing';
    case 'pause':
      return 'Paused';
    case 'seek':
      return arg.startsWith('-') ? `Back ${arg.slice(1)} s` : `Forward ${arg.replace('+', '')} s`;
    case 'volume':
      return `Volume ${arg}`;
    case 'brightness':
      return `Brightness ${arg}`;
    case 'ambient.movie':
      return 'Movie lights';
    case 'ambient.off':
      return 'Lights off';
    case 'ambient.bright':
      return 'Lights up';
    default:
      return 'Done';
  }
}
