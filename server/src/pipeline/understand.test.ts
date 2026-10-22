import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SceneMemory } from './scene-memory.js';
import { nameCharacters, replayFrames, understandFrames } from './understand.js';
import type { VisionModel } from './vlm.js';

let dir = '';
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  dir = '';
});

/** A model that answers from a script keyed by image content, and counts its calls. */
function scripted(replies: Record<string, string | Error>, digest = 'sha256:aaa') {
  const prompts: string[] = [];
  const failures = new Map<string, number>();
  const vision: VisionModel = {
    model: 'fake-vl',
    digest,
    ask(prompt, jpeg) {
      prompts.push(prompt);
      const key = jpeg.toString();
      const reply = replies[key];
      if (reply instanceof Error) {
        failures.set(key, (failures.get(key) ?? 0) + 1);
        return Promise.reject(reply);
      }
      return Promise.resolve({ raw: reply ?? '{}', ms: 5 });
    },
  };
  return { vision, prompts, failures };
}

function frames(...ids: string[]) {
  dir = dir || mkdtempSync(join(tmpdir(), 'pip-understand-'));
  return ids.map((id, i) => {
    const image = join(dir, `${id}.jpg`);
    writeFileSync(image, id);
    return { id, atSec: (i + 1) * 4, sceneId: 's1', image };
  });
}

const WOMAN = JSON.stringify({
  characters: [{ match: 'new', kind: 'person', looks: 'woman with red hair', doing: 'walks' }],
  action: 'A woman walks.',
});
const WOMAN_AGAIN = JSON.stringify({
  characters: [{ match: 'c1', kind: 'person', looks: 'woman with red hair', doing: 'sits' }],
  action: 'The woman sits.',
});

describe('understandFrames', () => {
  it('asks in story order with the roster so far, and resumes from the cache', async () => {
    const list = frames('fr-1', 'fr-2');
    const { vision, prompts } = scripted({ 'fr-1': WOMAN, 'fr-2': WOMAN_AGAIN });
    const cacheDir = join(dir, 'cache');
    const log: string[] = [];
    const memory = new SceneMemory();
    const records = await understandFrames({
      vision,
      memory,
      frames: list,
      cacheDir,
      log: (l) => log.push(l),
    });
    expect(prompts[0]).toContain('none yet');
    expect(prompts[1]).toContain('c1: woman with red hair (person)');
    expect(records.map((r) => r.rosterIds)).toEqual([[], ['c1']]);
    expect(memory.tracks).toHaveLength(1);

    const again = scripted({});
    await understandFrames({
      vision: again.vision,
      memory: new SceneMemory(),
      frames: list,
      cacheDir,
      log: () => {},
    });
    expect(again.prompts).toEqual([]);
  });

  it('asks again when the model changed', async () => {
    const list = frames('fr-1');
    const cacheDir = join(dir, 'cache');
    await understandFrames({
      vision: scripted({ 'fr-1': WOMAN }).vision,
      memory: new SceneMemory(),
      frames: list,
      cacheDir,
      log: () => {},
    });
    const newer = scripted({ 'fr-1': WOMAN }, 'sha256:bbb');
    await understandFrames({
      vision: newer.vision,
      memory: new SceneMemory(),
      frames: list,
      cacheDir,
      log: () => {},
    });
    expect(newer.prompts).toHaveLength(1);
  });

  it('retries a failed call once, then records the frame as unreadable and goes on', async () => {
    const list = frames('fr-1', 'fr-2');
    const { vision, failures } = scripted({ 'fr-1': new Error('timeout'), 'fr-2': WOMAN });
    const memory = new SceneMemory();
    const records = await understandFrames({
      vision,
      memory,
      frames: list,
      cacheDir: join(dir, 'c'),
      log: () => {},
    });
    expect(failures.get('fr-1')).toBe(2);
    expect(records[0]?.raw).toBe('');
    expect(memory.sightings[0]?.links).toEqual([]);
    expect(memory.tracks).toHaveLength(1);
  });

  it('replays recorded replies into the same memory without the model', async () => {
    const list = frames('fr-1', 'fr-2');
    const live = new SceneMemory();
    const records = await understandFrames({
      vision: scripted({ 'fr-1': WOMAN, 'fr-2': WOMAN_AGAIN }).vision,
      memory: live,
      frames: list,
      cacheDir: join(dir, 'c'),
      log: () => {},
    });
    const replayed = new SceneMemory();
    replayFrames(replayed, records);
    expect(replayed.tracks).toEqual(live.tracks);
    expect(replayed.sightings).toEqual(live.sightings);
  });
});

describe('nameCharacters', () => {
  it('asks about a heard name only with the characters on screen around it', async () => {
    const list = frames('fr-1', 'fr-2');
    const memory = new SceneMemory();
    await understandFrames({
      vision: scripted({ 'fr-1': WOMAN, 'fr-2': WOMAN_AGAIN }).vision,
      memory,
      frames: list,
      cacheDir: join(dir, 'c'),
      log: () => {},
    });
    const { vision, prompts } = scripted({ 'fr-2': '{"who":"c1","sure":true}' });
    const lines = [
      { id: 'ln-00080', startSec: 7, endSec: 8, text: 'Sit, Ann.' },
      { id: 'ln-00900', startSec: 90, endSec: 91, text: 'Bob!' },
      { id: 'ln-00085', startSec: 8, endSec: 9, text: 'Ann?' },
    ];
    const namings = await nameCharacters({
      vision,
      memory,
      lines,
      mentions: [
        { name: 'Ann', lineId: 'ln-00080', atSec: 8 },
        { name: 'Bob', lineId: 'ln-00900', atSec: 91 },
        { name: 'Ann', lineId: 'ln-00085', atSec: 9 },
      ],
      imageOf: (id) => join(dir, `${id}.jpg`),
      cacheDir: join(dir, 'c'),
      log: () => {},
    });
    expect(namings).toEqual([
      { name: 'Ann', lineId: 'ln-00080', trackId: 'c1' },
      { name: 'Bob', lineId: 'ln-00900', trackId: null }, // nobody on screen then: no question asked
    ]);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('"Sit, Ann."');
  });
});
