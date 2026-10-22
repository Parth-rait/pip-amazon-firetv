import { describe, expect, it } from 'vitest';
import { firstHeard, isRepetitionLoop, nameMentions, parseWhisperJson } from './transcript.js';

/** whisper.cpp's -oj shape, with only the fields the parser reads. */
function whisper(...segments: [number, number, string][]) {
  return {
    transcription: segments.map(([from, to, text]) => ({
      offsets: { from: from * 1000, to: to * 1000 },
      text,
    })),
  };
}

describe('parseWhisperJson', () => {
  it('keeps spoken lines with their times and stable ids', () => {
    const lines = parseWhisperJson(
      whisper(
        [106.94, 109.44, ' - This blade has a dark past.'],
        [227.54, 229.54, ' Goodnight, Scales.'],
      ),
    );
    expect(lines).toEqual([
      { id: 'ln-01069', startSec: 106.94, endSec: 109.44, text: 'This blade has a dark past.' },
      { id: 'ln-02275', startSec: 227.54, endSec: 229.54, text: 'Goodnight, Scales.' },
    ]);
  });

  it('drops music, sound captions and repetition loops', () => {
    const lines = parseWhisperJson(
      whisper(
        [0, 10, ' ♪♪'],
        [10, 12, ' [Door creaks]'],
        [12, 13, ' (laughs) Hey!'],
        [501, 508, " Oh, I'm sorry, I'm sorry, I'm sorry, I'm sorry, I'm sorry,"],
      ),
    );
    expect(lines.map((l) => l.text)).toEqual(['Hey!']);
  });

  it('gives two lines that start in the same tenth of a second different ids', () => {
    const lines = parseWhisperJson(whisper([5, 6, ' One.'], [5.01, 6, ' Two.']));
    expect(new Set(lines.map((l) => l.id)).size).toBe(2);
  });
});

describe('isRepetitionLoop', () => {
  it('flags a phrase said four times in a row, not ordinary repetition', () => {
    expect(isRepetitionLoop('sorry sorry sorry sorry')).toBe(true);
    expect(isRepetitionLoop('Shh, shh, shh. We are almost done.')).toBe(false);
    expect(isRepetitionLoop('Get him, Scales! Come on, get him!')).toBe(false);
  });
});

describe('nameMentions', () => {
  const lines = parseWhisperJson(
    whisper(
      [127, 133, ' So what brings you to the land of the gatekeepers?'],
      [227.54, 229.54, ' Goodnight, Scales.'],
      [249.96, 250.96, ' Get him, Scales! Come on, get him!'],
      [264.86, 265.76, ' Scales?'],
      [457.68, 460.48, ' These are dragon lands, Sintel.'],
      [500, 501, ' Hey, sit still. Thank you.'],
    ),
  );

  it('finds names said to someone or on their own, and when each is first heard', () => {
    const mentions = nameMentions(lines);
    expect(mentions.map((m) => `${m.name}@${m.atSec}`)).toEqual([
      'Scales@229.54',
      'Scales@250.96',
      'Scales@265.76',
      'Sintel@460.48',
    ]);
    expect(firstHeard(mentions)).toEqual(
      new Map([
        ['Scales', 229.54],
        ['Sintel', 460.48],
      ]),
    );
  });
});
