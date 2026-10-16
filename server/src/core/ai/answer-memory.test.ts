import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAnswerMemory, normalizeQuestion, similarity } from './answer-memory.js';

const film = 'big-buck-bunny';
const entry = (sceneSec: number, question: string, answer: string) => ({
  contentId: film,
  sceneSec,
  question,
  answer,
  next: ['Why?'],
});

describe('normalizeQuestion and similarity', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(normalizeQuestion('  Who IS   that?! ')).toBe('who is that');
  });

  it('scores shared topic words, ignoring little words', () => {
    expect(similarity('Why is the bunny sad?', 'why is bunny so sad')).toBe(1);
    expect(similarity('Who are those animals?', 'Who is that?')).toBe(0.5);
    expect(similarity('Where is the bird?', 'What is he carving?')).toBe(0);
  });
});

describe('createAnswerMemory', () => {
  it('recalls the same question at the same scene, and nothing for another scene', () => {
    const memory = createAnswerMemory({ now: () => 1 });
    memory.remember(entry(114, 'Who are they?', 'Three troublemakers.'));
    expect(
      memory.recallExact({ contentId: film, sceneSec: 114, question: 'who are they' }),
    ).toEqual({ answer: 'Three troublemakers.', next: ['Why?'] });
    expect(memory.recallExact({ contentId: film, sceneSec: 150, question: 'Who are they?' })).toBe(
      null,
    );
  });

  it('never recalls an answer from a scene the family has not reached', () => {
    const memory = createAnswerMemory({ now: () => 1 });
    memory.remember(entry(444, 'Is the bunny angry?', 'He caught the squirrel.'));
    expect(
      memory.recallSimilar({ contentId: film, sceneSec: 222, question: 'Is the bunny angry?' }),
    ).toBe(null);
  });

  it('prefers the latest earlier scene when questions match equally', () => {
    let t = 0;
    const memory = createAnswerMemory({ now: () => (t += 1) });
    memory.remember(entry(30, 'What just happened?', 'He woke up.'));
    memory.remember(entry(168, 'What just happened?', 'Fruit hit him.'));
    expect(
      memory.recallSimilar({ contentId: film, sceneSec: 192, question: 'What just happened?' })
        ?.answer,
    ).toBe('Fruit hit him.');
  });

  it('keeps answers in its file across restarts and survives a broken file', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pip-memory-')), 'memory.json');
    createAnswerMemory({ file, now: () => 1 }).remember(entry(60, 'Who is that?', 'The bunny.'));
    expect(JSON.parse(readFileSync(file, 'utf8'))).toHaveLength(1);
    const again = createAnswerMemory({ file, now: () => 2 });
    expect(again.recallExact({ contentId: film, sceneSec: 60, question: 'Who is that?' })).not.toBe(
      null,
    );

    writeFileSync(file, '{ not json');
    const errors: unknown[] = [];
    const broken = createAnswerMemory({ file, now: () => 3, onError: (e) => errors.push(e) });
    expect(errors).toHaveLength(1);
    expect(broken.recallSimilar({ contentId: film, sceneSec: 60, question: 'Who is that?' })).toBe(
      null,
    );
  });
});
