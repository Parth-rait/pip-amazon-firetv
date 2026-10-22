// Scene memory: the vision model's frame-by-frame observations become tracked characters, and the
// sightings plus the dialogue become candidate facts with honest reveal times. Pure and
// deterministic; the model calls happen in scripts/pipeline.ts (`understand`), so a recorded run
// can be replayed here exactly.
//
// Rules that keep it spoiler-safe:
// - Facts are built in story order from what was on screen or said by then; each fact's revealSec
//   is the frame or line it rests on, never later evidence.
// - A character is named only from dialogue: from the line where a name is heard and matched to
//   them. Before that the character is its look ("the baby dragon"), and the name is a restricted
//   term at runtime (Entity.namedSec).
// - Names the model might know from outside the film are scrubbed from its text until revealed.
import { containsTerm, contentWords } from '../core/context/text.js';
import type { CandidatesFile } from './artifacts.js';
import type { TranscriptLine } from './transcript.js';
import type { CharacterKind, FrameObservation, RosterLine } from './vlm.js';

/**
 * How much each kind of claim is trusted. Initial values, not yet calibrated against reviewed
 * facts; `npm run pipeline -- understand <asset>` prints the tracking score to check them against.
 */
export const CONFIDENCE = {
  modelLink: 0.75, // the model said "this is c2" and the kind agrees
  modelLinkLooksAgree: 0.85, // ... and its words match the earlier description
  continuityLink: 0.6, // same kind and similar words within a few seconds
  newCharacter: 0.5, // first sighting: not yet confirmed by a second one
  caption: 0.7, // what the frame shows (action, setting, objects)
  dialogue: 0.85, // whisper.cpp small.en on clear film dialogue
  naming: 0.7, // the model matched a heard name to a visible character
} as const;

const CONTINUITY_WINDOW_SEC = 12;
const MIN_SIMILARITY = 0.34;
const ROSTER_SIZE = 8;
const RECENT_SEC = 120;
const REAPPEAR_GAP_SEC = 60;
const SAME_EVENT_SIMILARITY = 0.5;
const SETTING_CHANGE_SIMILARITY = 0.2;
const SETTING_RETURN_SIMILARITY = 0.5;
const SETTING_RETURN_GAP_SEC = 90;
const ON_SCREEN_WINDOW_SEC = 8;

export interface SampledFrame {
  id: string;
  atSec: number;
  sceneId: string | null;
}

export interface Link {
  trackId: string;
  how: 'model' | 'continuity' | 'new';
  confidence: number;
  looks: string;
  doing: string;
}

export interface Sighting {
  frame: SampledFrame;
  links: Link[];
  action: string;
  setting: string;
  objects: string[];
  textOnScreen: string;
}

export interface Track {
  id: string;
  kind: CharacterKind;
  looks: string[]; // every description, in order
  firstSec: number;
  lastSec: number;
  sightings: number;
}

function words(text: string): Set<string> {
  return new Set(contentWords(text));
}

/** Jaccard overlap of the meaningful words of two descriptions. */
export function similarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return 0;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / (x.size + y.size - shared);
}

export function compatibleKinds(a: CharacterKind, b: CharacterKind): boolean {
  if (a === b || a === 'other' || b === 'other') return true;
  return (a === 'animal' && b === 'creature') || (a === 'creature' && b === 'animal');
}

// Words for a far-off or unclear view: a description made of them says little about who it is.
const VAGUE = /\b(figure|silhouette|shape|person|someone|character|creature|shadow|blur)\b/i;

/**
 * The description of a track that agrees most with all its others (a medoid), so a few distant
 * shots ("small figure in snow") do not name a character seen up close many times. Vague
 * descriptions count half; ties go to the earliest.
 */
function describe(track: Track): string {
  const looks = track.looks.map((l) => l.toLowerCase());
  let best = looks[0] ?? track.kind;
  let bestScore = -1;
  for (const candidate of new Set(looks)) {
    const agreement = looks.reduce((sum, other) => sum + similarity(candidate, other), 0);
    const score = VAGUE.test(candidate) ? agreement / 2 : agreement;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Tracks characters across frames. Feed frames in time order. */
export class SceneMemory {
  readonly tracks: Track[] = [];
  readonly sightings: Sighting[] = [];

  /** The characters the next prompt lists: recently seen first, then the most seen. */
  roster(atSec: number): RosterLine[] {
    const recent = this.tracks
      .filter((t) => atSec - t.lastSec <= RECENT_SEC)
      .sort((a, b) => b.lastSec - a.lastSec);
    const others = this.tracks
      .filter((t) => !recent.includes(t))
      .sort((a, b) => b.sightings - a.sightings);
    return [...recent, ...others]
      .slice(0, ROSTER_SIZE)
      .map((t) => ({ id: t.id, kind: t.kind, looks: describe(t) }));
  }

  /** Roster lines for exactly these tracks, in the given order. */
  describeTracks(ids: string[]): RosterLine[] {
    return ids.flatMap((id) => {
      const t = this.tracks.find((x) => x.id === id);
      return t ? [{ id: t.id, kind: t.kind, looks: describe(t) }] : [];
    });
  }

  /** Adds one frame's observation; null means the model's reply was unusable. */
  observe(frame: SampledFrame, obs: FrameObservation | null): Sighting {
    const used = new Set<string>();
    const links: Link[] = [];
    for (const c of obs?.characters ?? []) {
      const link = this.linkFor(frame, c, used);
      used.add(link.trackId);
      links.push(link);
    }
    const sighting: Sighting = {
      frame,
      links,
      action: obs?.action ?? '',
      setting: obs?.setting ?? '',
      objects: obs?.objects ?? [],
      textOnScreen: obs?.textOnScreen ?? '',
    };
    this.sightings.push(sighting);
    return sighting;
  }

  private linkFor(
    frame: SampledFrame,
    c: FrameObservation['characters'][number],
    used: Set<string>,
  ): Link {
    const base = { looks: c.looks, doing: c.doing };
    const claimed = c.match ? this.tracks.find((t) => t.id === c.match) : undefined;
    if (claimed && !used.has(claimed.id) && compatibleKinds(claimed.kind, c.kind)) {
      const agrees = similarity(describe(claimed), c.looks) >= MIN_SIMILARITY;
      return this.extend(claimed, frame, c.looks, {
        ...base,
        trackId: claimed.id,
        how: 'model',
        confidence: agrees ? CONFIDENCE.modelLinkLooksAgree : CONFIDENCE.modelLink,
      });
    }
    // The model said "new" (or named a wrong id): the same look seconds ago is the same character.
    const nearby = this.tracks
      .filter(
        (t) =>
          !used.has(t.id) &&
          compatibleKinds(t.kind, c.kind) &&
          frame.atSec - t.lastSec <= CONTINUITY_WINDOW_SEC,
      )
      .map((t) => ({ t, score: similarity(describe(t), c.looks) }))
      .filter((x) => x.score >= MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score)[0];
    if (nearby) {
      return this.extend(nearby.t, frame, c.looks, {
        ...base,
        trackId: nearby.t.id,
        how: 'continuity',
        confidence: CONFIDENCE.continuityLink,
      });
    }
    const track: Track = {
      id: `c${this.tracks.length + 1}`,
      kind: c.kind,
      looks: [c.looks],
      firstSec: frame.atSec,
      lastSec: frame.atSec,
      sightings: 1,
    };
    this.tracks.push(track);
    return { ...base, trackId: track.id, how: 'new', confidence: CONFIDENCE.newCharacter };
  }

  private extend(track: Track, frame: SampledFrame, looks: string, link: Link): Link {
    track.looks.push(looks);
    track.lastSec = frame.atSec;
    track.sightings += 1;
    return link;
  }
}

/** A heard name matched to a character by the model (or not matched: trackId null). */
export interface Naming {
  name: string;
  lineId: string;
  trackId: string | null;
}

export interface FinalizeInput {
  assetId: string;
  generator: string;
  createdAt: string;
  method: string;
  memory: SceneMemory;
  scenes: { id: string; startSec: number; endSec: number }[];
  lines: TranscriptLine[];
  heard: Map<string, number>; // every spoken name and when it is first heard
  namings: Naming[];
  knownNames?: Map<string, number>; // names the viewer has before the film (title card), at 0
  coveredUntilSec?: number; // how far the frames were looked at (a partial run stops early)
}

const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/** "young woman with red hair, brown cloak" -> "young woman with red hair". */
export function shortLabel(looks: string): string {
  // Cut at a comma that ends a description, not one between adjectives ("small, grey, reptilian").
  const first = looks.split(/[,;]| and (?=\w+ing\b)/)[0]?.trim() ?? looks;
  const head = first.split(/\s+/).length >= 3 ? first : looks.replace(/[,;]/g, ' ').trim();
  return clip(
    head
      .replace(/^(a|an|the)\s+/i, '')
      .split(/\s+/)
      .slice(0, 7)
      .join(' ')
      .toLowerCase(),
    60,
  );
}

function withArticle(label: string, definite: boolean): string {
  if (definite) return `the ${label}`;
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}

function place(setting: string): string {
  const s = setting.replace(/[.]+$/, '').trim();
  if (!s) return '';
  if (/^(in|on|at|inside|outside|near|by|under|over)\b/i.test(s)) return ` ${s.toLowerCase()}`;
  return ` in ${/^(a|an|the)\b/i.test(s) ? s.toLowerCase() : withArticle(s.toLowerCase(), false)}`;
}

/** Turns the memory and dialogue into the candidates file the review and export stages read. */
export function finalizeCandidates(input: FinalizeInput): CandidatesFile {
  const { memory } = input;
  const named = resolveNames(input);
  const revealOf = new Map(input.heard);
  for (const [name, sec] of input.knownNames ?? [])
    revealOf.set(name, Math.min(sec, revealOf.get(name) ?? sec));
  // Model text may carry a name the viewer has not heard yet (it may know the film): blank it.
  const scrub = (text: string, atSec: number) => {
    let out = text;
    for (const [name, sec] of revealOf) {
      if (sec > atSec && containsTerm(out, name)) {
        out = out.replace(new RegExp(`\\b${name}(['’]s)?\\b`, 'gi'), (_m, _s, offset: number) =>
          offset === 0 || /[.!?]\s*$/.test(out.slice(0, offset)) ? 'Someone' : 'someone',
        );
      }
    }
    return out;
  };

  const kept = new Map(
    memory.tracks.filter((t) => t.sightings >= 2 || named.has(t.id)).map((t) => [t.id, t]),
  );
  const labelOf = new Map([...kept.values()].map((t) => [t.id, shortLabel(describe(t))]));
  const callAt = (id: string, sec: number, definite = true) => {
    const name = named.get(id);
    if (name && name.atSec <= sec) return name.name;
    return withArticle(labelOf.get(id) ?? 'someone', definite);
  };

  const entities: CandidatesFile['entities'] = [];
  for (const track of kept.values()) {
    const first = memory.sightings.find((s) => s.links.some((l) => l.trackId === track.id));
    const label = labelOf.get(track.id) ?? track.kind;
    const intro = clip(
      `${capital(withArticle(label, false))}, first seen${place(scrub(first?.setting ?? '', track.firstSec))} at ${mmss(track.firstSec)}.`,
      200,
    );
    const name = named.get(track.id);
    // A name the viewer has from the film card (the title) is theirs from the first sighting.
    const knownBefore = name ? (input.knownNames?.has(name.name) ?? false) : false;
    entities.push(
      name && knownBefore
        ? { id: track.id, name: name.name, aliases: [label], firstSeenSec: track.firstSec, intro }
        : name
          ? {
              id: track.id,
              name: name.name,
              aliases: [label],
              firstSeenSec: track.firstSec,
              intro,
              label,
              namedSec: Math.max(name.atSec, track.firstSec),
            }
          : { id: track.id, name: label, aliases: [], firstSeenSec: track.firstSec, intro },
    );
  }

  const facts: CandidatesFile['facts'] = [];
  const sceneStart = (frame: SampledFrame) =>
    input.scenes.find((s) => s.id === frame.sceneId)?.startSec ?? frame.atSec;
  const lastSeen = new Map<string, Sighting>();
  let previous: Sighting | null = null;
  const settings: { sec: number; setting: string }[] = [];

  for (const s of memory.sightings) {
    const t = s.frame.atSec;
    const start = Math.min(sceneStart(s.frame), t);
    const links = s.links.filter((l) => kept.has(l.trackId));
    const ids = [...new Set(links.map((l) => l.trackId))];
    const linkConfidence = Math.min(CONFIDENCE.caption, ...links.map((l) => l.confidence));

    for (const link of links) {
      const track = kept.get(link.trackId);
      const before = lastSeen.get(link.trackId);
      if (track && track.firstSec === t && !before) {
        const doing = link.doing ? `: ${scrub(link.doing, t)}` : '';
        facts.push({
          id: `ap-${link.trackId}`,
          startSec: start,
          revealSec: t,
          kind: 'appearance',
          text: clip(
            `${capital(callAt(link.trackId, t, false))} appears for the first time${doing}.`,
            300,
          ),
          entities: [link.trackId],
          spoilerTerms: [],
          evidence: [s.frame.id],
          confidence: link.confidence,
        });
      } else if (before && t - before.frame.atSec >= REAPPEAR_GAP_SEC) {
        const earlier = before.action ? ` (${scrub(before.action, t).replace(/[.]+$/, '')})` : '';
        facts.push({
          id: `ra-${link.trackId}-${s.frame.id}`,
          startSec: start,
          revealSec: t,
          kind: 'relation',
          text: clip(
            `${capital(callAt(link.trackId, t))} is back, last seen at ${mmss(before.frame.atSec)}${earlier}.`,
            300,
          ),
          entities: [link.trackId],
          spoilerTerms: [],
          evidence: [before.frame.id, s.frame.id],
          confidence: link.confidence,
        });
      }
      lastSeen.set(link.trackId, s);
    }

    const sameScene = previous?.frame.sceneId === s.frame.sceneId && s.frame.sceneId !== null;
    // A new place, said once per scene change: the model rewords the same place frame to frame.
    const moved =
      !previous ||
      (!sameScene && similarity(previous.setting, s.setting) < SETTING_CHANGE_SIMILARITY);
    if (s.setting && moved) {
      const back = [...settings]
        .reverse()
        .find(
          (x) =>
            t - x.sec >= SETTING_RETURN_GAP_SEC &&
            similarity(x.setting, s.setting) >= SETTING_RETURN_SIMILARITY,
        );
      const setting = scrub(s.setting, t).replace(/[.]+$/, '');
      facts.push({
        id: `st-${s.frame.id}`,
        startSec: start,
        revealSec: t,
        kind: back ? 'relation' : 'setting',
        text: clip(
          back
            ? `Back${place(setting)}, last shown at ${mmss(back.sec)}.`
            : `The scene is${place(setting)}.`,
          300,
        ),
        entities: [],
        spoilerTerms: [],
        evidence: [s.frame.id],
        confidence: CONFIDENCE.caption,
      });
    }
    if (s.setting) settings.push({ sec: t, setting: s.setting });

    const repeat =
      sameScene && previous && similarity(previous.action, s.action) >= SAME_EVENT_SIMILARITY;
    if (s.action && !repeat) {
      const extra = [
        s.objects.length ? ` Also visible: ${s.objects.join(', ')}.` : '',
        s.textOnScreen ? ` Text on screen: "${s.textOnScreen}".` : '',
      ].join('');
      facts.push({
        id: `ev-${s.frame.id}`,
        startSec: start,
        revealSec: t,
        kind: 'event',
        text: clip(scrub(`${capital(s.action.replace(/[.]*$/, '.'))}${extra}`, t), 300),
        entities: ids.slice(0, 8),
        spoilerTerms: [],
        evidence: [s.frame.id],
        confidence: Math.round(linkConfidence * 100) / 100,
      });
    }
    previous = s;
  }

  const onScreenAt = (sec: number) => {
    const s = [...memory.sightings]
      .reverse()
      .find((x) => x.frame.atSec <= sec && sec - x.frame.atSec <= ON_SCREEN_WINDOW_SEC);
    return s ? [...new Set(s.links.map((l) => l.trackId).filter((id) => kept.has(id)))] : [];
  };
  const entityById = new Map(entities.map((e) => [e.id, e]));
  for (const line of input.lines) {
    facts.push({
      id: `dl-${line.id}`,
      startSec: line.startSec,
      revealSec: line.endSec,
      kind: 'dialogue',
      text: clip(`Someone says: "${line.text}"`, 300),
      // Who is on screen while it is said; whisper does not tell who speaks.
      entities: onScreenAt(line.endSec).filter(
        (id) => (entityById.get(id)?.firstSeenSec ?? Infinity) <= line.endSec,
      ),
      spoilerTerms: [],
      evidence: [line.id],
      confidence: CONFIDENCE.dialogue,
    });
  }

  for (const [trackId, name] of named) {
    if (!kept.has(trackId)) continue;
    const line = input.lines.find((l) => l.id === name.lineId);
    const atSec = Math.max(name.atSec, kept.get(trackId)?.firstSec ?? 0);
    const frame = [...memory.sightings]
      .reverse()
      .find((s) => s.frame.atSec <= atSec + 0.5 && s.links.some((l) => l.trackId === trackId));
    facts.push({
      id: `nm-${trackId}`,
      startSec: line?.startSec ?? atSec,
      revealSec: atSec,
      kind: 'relation',
      text: clip(
        `${capital(withArticle(labelOf.get(trackId) ?? 'someone', true))} is called ${name.name}: someone says "${line?.text ?? name.name}"`,
        300,
      ),
      entities: [trackId],
      spoilerTerms: input.knownNames?.has(name.name) ? [] : [name.name],
      evidence: [...(line ? [line.id] : []), ...(frame ? [frame.frame.id] : [])],
      confidence: CONFIDENCE.naming,
    });
  }

  markFirstMentions(
    facts,
    [
      ...[...kept.values()].map((t) => labelOf.get(t.id) ?? ''),
      ...memory.sightings.flatMap((s) => s.objects),
    ],
    // A heard name nobody was matched to still must not be said before it is heard.
    [...input.heard.keys()],
  );
  facts.sort((a, b) => a.startSec - b.startSec || a.revealSec - b.revealSec);
  return {
    schemaVersion: 1,
    assetId: input.assetId,
    generator: input.generator,
    createdAt: input.createdAt,
    method: input.method,
    entities: entities.sort((a, b) => a.firstSeenSec - b.firstSeenSec),
    facts: facts.filter((f) => f.evidence.length > 0),
    ...(input.coveredUntilSec !== undefined ? { coveredUntilSec: input.coveredUntilSec } : {}),
  };
}

// Heads of the model's object phrases that are not things the film shows ("hand reaching forward").
const NOT_THINGS = new Set(
  (
    'down up forward backward overhead flying hazy object structure thing area background ' +
    'foreground part side edge surface detail light shadow scene view distance left right top ' +
    'bottom center centre front back middle small large'
  ).split(' '),
);

/** "small baby dragon with a hurt wing" -> "dragon"; "wooden bowl" -> "bowl". */
export function headNoun(phrase: string): string | null {
  const head =
    phrase.toLowerCase().split(/\b(?:with|in|on|of|holding|wearing|near|and)\b|[,;(]/)[0] ?? '';
  const words = contentWords(head);
  const last = words[words.length - 1];
  return last && last.length >= 3 && !NOT_THINGS.has(last) ? last : null;
}

/**
 * Each thing the film shows (a character's kind, an object) is a spoiler term of the first fact,
 * seen or said, that mentions it: before then, Pip may not use the word ("dragon" before anyone
 * has said or shown a dragon). After it, the word is in revealed text and free to use.
 */
function markFirstMentions(
  facts: CandidatesFile['facts'],
  phrases: string[],
  names: string[],
): void {
  const vocabulary = new Set([
    ...phrases.map(headNoun).filter((w): w is string => w !== null),
    ...names.flatMap((n) => contentWords(n)),
  ]);
  const mentioned = new Set<string>();
  for (const fact of [...facts].sort((a, b) => a.revealSec - b.revealSec)) {
    const words = contentWords(fact.text);
    const first = [...new Set(words.filter((w) => vocabulary.has(w) && !mentioned.has(w)))];
    fact.spoilerTerms = [...new Set([...fact.spoilerTerms, ...first])].slice(0, 8);
    for (const w of words) mentioned.add(w);
  }
}

/**
 * Which character each heard name belongs to: the first matched mention wins, one name per
 * character and one character per name.
 */
function resolveNames(
  input: FinalizeInput,
): Map<string, { name: string; atSec: number; lineId: string }> {
  const lineEnd = new Map(input.lines.map((l) => [l.id, l.endSec]));
  const named = new Map<string, { name: string; atSec: number; lineId: string }>();
  const taken = new Set<string>();
  const ordered = [...input.namings].sort(
    (a, b) => (lineEnd.get(a.lineId) ?? 0) - (lineEnd.get(b.lineId) ?? 0),
  );
  for (const n of ordered) {
    if (!n.trackId || taken.has(n.name) || named.has(n.trackId)) continue;
    named.set(n.trackId, { name: n.name, atSec: lineEnd.get(n.lineId) ?? 0, lineId: n.lineId });
    taken.add(n.name);
  }
  return named;
}
