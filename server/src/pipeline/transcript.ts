// Timestamped dialogue from whisper.cpp's JSON output: lines people can be told about, and the names
// spoken in them. A name said aloud is how a viewer learns it, so these times bound name reveals.
import { z } from 'zod';

export interface TranscriptLine {
  id: string; // "ln-01121": the line that starts at 112.1 s
  startSec: number;
  endSec: number;
  text: string;
}

const whisperSchema = z.object({
  transcription: z.array(
    z.object({ offsets: z.object({ from: z.number(), to: z.number() }), text: z.string() }),
  ),
});

// Captions for sounds and music ("[Door creaks]", "(laughs)", "♪♪"), not words anyone says.
const NON_SPEECH = /\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|[♪♫]+/g;

/**
 * True for whisper's repetition loop ("I'm sorry, I'm sorry, I'm sorry, ..."): one short phrase
 * said four or more times in a row. A known failure on music and silence, not dialogue.
 */
export function isRepetitionLoop(text: string): boolean {
  const w = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  for (let size = 1; size <= 4; size += 1) {
    for (let start = 0; start + size * 4 <= w.length; start += 1) {
      const phrase = w.slice(start, start + size).join(' ');
      let repeats = 1;
      while (w.slice(start + repeats * size, start + (repeats + 1) * size).join(' ') === phrase)
        repeats += 1;
      if (repeats >= 4) return true;
    }
  }
  return false;
}

/** Spoken lines in time order. Sound captions and empty segments are dropped. */
export function parseWhisperJson(data: unknown): TranscriptLine[] {
  const parsed = whisperSchema.parse(data);
  const lines: TranscriptLine[] = [];
  const ids = new Set<string>();
  for (const segment of parsed.transcription) {
    const text = segment.text
      .replace(NON_SPEECH, ' ')
      .replace(/^\s*-\s*/, '') // a dash marking a change of speaker
      .replace(/\s+/g, ' ')
      .trim();
    if (!/[\p{L}\p{N}]/u.test(text) || isRepetitionLoop(text)) continue;
    const startSec = segment.offsets.from / 1000;
    let id = `ln-${String(Math.round(startSec * 10)).padStart(5, '0')}`;
    for (let n = 2; ids.has(id); n += 1) id = `${id.split('_')[0]}_${n}`;
    ids.add(id);
    lines.push({ id, startSec, endSec: Math.max(segment.offsets.to / 1000, startSec), text });
  }
  return lines;
}

// Capitalised words that start commands or greetings, never names.
const NOT_NAMES = new Set(
  (
    'I Im Ive Id Ill Um Uh Shh Hey Hi Oh Ah No Yes Yeah Ok Okay Thank Thanks Goodnight Good Come Get ' +
    'Go Look Wait Stop Please Sorry Mr Mrs Ms Sir God Who What Why Where When How So And But The A An ' +
    'It Its This That You We He She They My Your Our Let Lets Run Help Dont Hello Bye'
  ).split(' '),
);

export interface NameMention {
  name: string;
  lineId: string;
  atSec: number; // the end of the line: when the viewer has heard it
}

/**
 * Names spoken in the dialogue: capitalised words that are not the first word of a sentence, or that
 * are a whole sentence on their own ("Scales!"). The first mention is when the name is revealed.
 */
export function nameMentions(lines: TranscriptLine[]): NameMention[] {
  const mentions: NameMention[] = [];
  for (const line of lines) {
    for (const sentence of line.text.split(/(?<=[.!?])\s+/)) {
      const words = sentence.split(/\s+/).filter(Boolean);
      words.forEach((raw, i) => {
        const word = raw.replace(/[^\p{L}'’-]/gu, '').replace(/['’]s$/, '');
        if (!/^\p{Lu}\p{Ll}{2,}$/u.test(word) || NOT_NAMES.has(word.replace(/['’]/g, ''))) return;
        if (i === 0 && words.length > 1) return;
        mentions.push({ name: word, lineId: line.id, atSec: line.endSec });
      });
    }
  }
  return mentions;
}

/** When each spoken name is first heard. */
export function firstHeard(mentions: NameMention[]): Map<string, number> {
  const first = new Map<string, number>();
  for (const m of mentions) if (!first.has(m.name)) first.set(m.name, m.atSec);
  return first;
}
