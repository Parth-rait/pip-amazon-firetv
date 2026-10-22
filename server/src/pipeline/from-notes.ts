// A timeline from a film's reviewed notes and character cards (content/<id>.json), so the films
// in the demo answer through the grounded path (answer.ts: spoiler boundary, retrieval, answer
// gate) instead of the notes prompt. Each note becomes an accepted fact with a frame as evidence;
// each character card becomes an entity, introduced by its first card fact. The cards' later facts
// retell the notes, so they are not facts again (Pip would say everything twice). Pure: the script (scripts/timeline-from-notes.ts) reads
// and writes the files.
import { containsTerm, contentWords } from '../core/context/text.js';
import type { Content } from '../film/content.js';
import type { TimelineFile } from '../film/timeline-file.js';
import { LINES } from '../lines.js';

// Pip's own fixed lines may always be said ("Keep watching"), so their words are never spoilers.
const PIP_TEXT = Object.values(LINES)
  .map((line) => (typeof line === 'string' ? line : line(10 as never)))
  .join('\n');

/** A note describes a beat that may run a few seconds past its time: it counts once it is over. */
export const REVEAL_LAG_SEC = 10;
const MAX_SPOILER_TERMS = 8;
const MAX_LINES_PER_FACT = 3;
const DIALOGUE = /\b(says|said|shouts|whispers|tells|asks|cries out|thanks)\b/i;

export interface FromNotesInput {
  film: Content;
  reviewer: string; // who checked the notes against the film
  reviewedAt: string; // ISO date
  sha256: string | null; // of the media file, when it is here
  license: string;
  lines?: TimelineFile['lines']; // speech recognition, kept as evidence
}

type Fact = TimelineFile['facts'][number];
type Entity = TimelineFile['entities'][number];

const pad = (n: number) => String(n).padStart(2, '0');

export function timelineFromNotes(input: FromNotesInput): TimelineFile {
  const { film } = input;
  const end = film.durationSec;
  const review = {
    status: 'accepted' as const,
    by: input.reviewer,
    at: input.reviewedAt,
    note: 'checked against a frame at the note time',
  };
  const revealOf = (atSec: number) => Math.min(atSec + REVEAL_LAG_SEC, end);
  const evidenceAt = (atSec: number) => Math.min(atSec + 2, end);

  const entities: Entity[] = film.characters.map((c) => ({
    id: c.id,
    name: c.name,
    aliases: aliasesOf(c.name, c.aliases ?? []),
    firstSeenSec: Math.min(...c.facts.map((f) => f.atSec)),
    intro: c.facts[0]?.text ?? c.name,
    review,
  }));
  const linked = (text: string, revealSec: number) =>
    entities
      .filter((e) => e.firstSeenSec <= revealSec)
      .filter((e) => [e.name, ...e.aliases].some((term) => containsTerm(text, term)))
      .map((e) => e.id)
      .slice(0, 8);

  const frames: TimelineFile['frames'] = [];
  const drafts: Omit<Fact, 'spoilerTerms' | 'sceneId'>[] = [];
  film.notes.forEach((note, i) => {
    const frame = { id: `fr-n${pad(i)}`, atSec: evidenceAt(note.atSec) };
    frames.push(frame);
    const revealSec = revealOf(note.atSec);
    drafts.push({
      id: `n${pad(i)}`,
      startSec: note.atSec,
      revealSec,
      kind: DIALOGUE.test(note.text) ? 'dialogue' : 'event',
      text: note.text,
      entities: linked(note.text, revealSec),
      evidence: [frame.id, ...linesNear(input.lines ?? [], note.atSec, revealSec)],
      confidence: 0.9,
      generator: 'notes/1 (content notes, written from frames and subtitles)',
      review,
    });
  });
  drafts.sort((a, b) => a.startSec - b.startSec || a.id.localeCompare(b.id));
  frames.sort((a, b) => a.atSec - b.atSec || a.id.localeCompare(b.id));

  const scenes = scenesFrom(film, end);
  const sceneOf = (sec: number) =>
    scenes.find((s) => sec >= s.startSec && sec < s.endSec)?.id ?? scenes.at(-1)?.id;
  const facts = withFirstMentions(drafts, film.title).map((f) => ({
    ...f,
    sceneId: sceneOf(f.startSec),
  }));

  return {
    schemaVersion: 1,
    contentId: film.id,
    durationSec: end,
    source: { assetId: film.id, sha256: input.sha256, license: input.license, rights: film.credit },
    frames,
    lines: input.lines ?? [],
    scenes,
    entities: entities.sort((a, b) => a.firstSeenSec - b.firstSeenSec),
    facts: facts as Fact[],
  };
}

/** "The purple bird" is also "purple bird"; listed aliases are added. */
function aliasesOf(name: string, listed: string[]): string[] {
  const bare = name.replace(/^the\s+/i, '');
  const all = bare !== name ? [bare, ...listed] : listed;
  return [...new Set(all.map((a) => a.trim()).filter((a) => a.length > 1))].slice(0, 8);
}

function linesNear(lines: TimelineFile['lines'], fromSec: number, toSec: number): string[] {
  return lines
    .filter((l) => l.endSec >= fromSec - 2 && l.endSec <= toSec)
    .slice(0, MAX_LINES_PER_FACT)
    .map((l) => l.id);
}

/** One scene per chapter: chapters mark when a part of the story is over. */
function scenesFrom(film: Content, end: number): TimelineFile['scenes'] {
  const cuts = [
    ...new Set([0, ...film.chapters.map((c) => c.atSec).filter((t) => t < end), end]),
  ].sort((a, b) => a - b);
  return cuts.slice(0, -1).map((startSec, i) => ({
    id: `sc-${pad(i + 1)}`,
    startSec,
    endSec: cuts[i + 1] ?? end,
  }));
}

/**
 * The words a fact says first are its spoiler terms: before it is revealed Pip may not use them
 * ("scar" before the scar is seen). The longest first, as they carry the most meaning; words of
 * the title and of Pip's fixed lines are known from the start.
 */
function withFirstMentions<T extends { revealSec: number; text: string }>(
  facts: T[],
  title: string,
): (T & { spoilerTerms: string[] })[] {
  const said = new Set(contentWords(title));
  const ordered = [...facts].sort((a, b) => a.revealSec - b.revealSec);
  const terms = new Map<T, string[]>();
  for (const fact of ordered) {
    const words = contentWords(fact.text).filter(
      (w) => w.length >= 4 && !containsTerm(PIP_TEXT, w),
    );
    const first = [...new Set(words.filter((w) => !said.has(w)))]
      .sort((a, b) => b.length - a.length)
      .slice(0, MAX_SPOILER_TERMS);
    terms.set(fact, first);
    for (const w of words) said.add(w);
  }
  return facts.map((f) => ({ ...f, spoilerTerms: terms.get(f) ?? [] }));
}
