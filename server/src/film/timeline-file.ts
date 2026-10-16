// The canonical timeline file (content/timelines/<film id>.json): schema, cross-checks and loading.
// The video pipeline writes it; the server reads it. One schema for both, so they cannot drift.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { emptyTimeline, type Timeline, type TimedFact } from '../core/context/timeline.js';
import type { Content } from './content.js';

export const TIMELINE_SCHEMA_VERSION = 1;

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i, 'letters, digits, _ and - only');
const seconds = z.number().finite().min(0);
const reviewSchema = z.object({
  status: z.enum(['candidate', 'accepted', 'rejected', 'needs-change']),
  by: z.string().max(80).nullable(), // who reviewed; null for an unreviewed candidate
  at: z.string().max(40).nullable(), // ISO date of the review
  note: z.string().max(300).optional(),
});

export const timelineFileSchema = z.object({
  schemaVersion: z.literal(TIMELINE_SCHEMA_VERSION),
  contentId: id,
  durationSec: z.number().positive(),
  source: z.object({
    assetId: id,
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(), // null when the media was not available
    license: z.string().min(1).max(120),
    rights: z.string().min(1).max(400),
  }),
  frames: z.array(z.object({ id, atSec: seconds, path: z.string().max(200).optional() })),
  scenes: z.array(z.object({ id, startSec: seconds, endSec: seconds })),
  entities: z.array(
    z.object({
      id,
      name: z.string().min(1).max(60),
      aliases: z.array(z.string().min(1).max(60)).max(8),
      firstSeenSec: seconds,
      intro: z.string().min(1).max(200),
      review: reviewSchema,
    }),
  ),
  facts: z.array(
    z.object({
      id,
      sceneId: id.optional(),
      startSec: seconds,
      revealSec: seconds,
      kind: z.enum(['event', 'appearance', 'setting', 'dialogue', 'relation']),
      text: z.string().min(1).max(300),
      entities: z.array(id).max(8),
      spoilerTerms: z.array(z.string().min(2).max(40)).max(8),
      evidence: z.array(id).max(8), // frame ids
      confidence: z.number().min(0).max(1),
      generator: z.string().min(1).max(80), // what proposed it, with a version
      review: reviewSchema,
    }),
  ),
});

export type TimelineFile = z.infer<typeof timelineFileSchema>;

function duplicates(ids: string[]): string[] {
  return ids.filter((value, i) => ids.indexOf(value) !== i);
}

/** Every cross-reference and time rule the schema alone cannot express. Empty means valid. */
export function timelineProblems(file: TimelineFile): string[] {
  const problems: string[] = [];
  const end = file.durationSec;
  const frames = new Map(file.frames.map((f) => [f.id, f.atSec]));
  const entities = new Map(file.entities.map((e) => [e.id, e]));
  const scenes = new Set(file.scenes.map((s) => s.id));
  for (const [kind, ids] of [
    ['frame', file.frames.map((f) => f.id)],
    ['scene', file.scenes.map((s) => s.id)],
    ['entity', file.entities.map((e) => e.id)],
    ['fact', file.facts.map((f) => f.id)],
  ] as const) {
    for (const dup of new Set(duplicates([...ids]))) problems.push(`duplicate ${kind} id ${dup}`);
  }
  file.frames.forEach((f) => f.atSec > end && problems.push(`frame ${f.id} is after the end`));
  file.scenes.forEach((s, i) => {
    if (s.endSec <= s.startSec || s.endSec > end) problems.push(`scene ${s.id} has a bad range`);
    const prev = file.scenes[i - 1];
    if (prev && s.startSec < prev.endSec) problems.push(`scene ${s.id} overlaps ${prev.id}`);
  });
  file.entities.forEach(
    (e) => e.firstSeenSec > end && problems.push(`entity ${e.id} is after the end`),
  );
  file.facts.forEach((fact, i) =>
    problems.push(...factProblems(fact, i, file, frames, entities, scenes)),
  );
  return problems;
}

function factProblems(
  fact: TimelineFile['facts'][number],
  index: number,
  file: TimelineFile,
  frames: Map<string, number>,
  entities: Map<string, TimelineFile['entities'][number]>,
  scenes: Set<string>,
): string[] {
  const out: string[] = [];
  const where = `fact ${fact.id}`;
  if (fact.revealSec < fact.startSec) out.push(`${where}: revealSec is before startSec`);
  if (fact.revealSec > file.durationSec) out.push(`${where}: revealSec is after the end`);
  const prev = file.facts[index - 1];
  if (prev && fact.startSec < prev.startSec)
    out.push(`${where}: facts must be in order of startSec`);
  if (fact.sceneId && !scenes.has(fact.sceneId))
    out.push(`${where}: unknown scene ${fact.sceneId}`);
  for (const entityId of fact.entities) {
    const entity = entities.get(entityId);
    if (!entity) out.push(`${where}: unknown entity ${entityId}`);
    else if (entity.firstSeenSec > fact.revealSec) {
      out.push(`${where}: names ${entityId} before it is first seen`);
    }
  }
  for (const frameId of fact.evidence) {
    const atSec = frames.get(frameId);
    if (atSec === undefined) out.push(`${where}: unresolved evidence ${frameId}`);
    else if (atSec > fact.revealSec + 0.5)
      out.push(`${where}: evidence ${frameId} is after its reveal`);
  }
  if (fact.review.status === 'accepted') {
    if (fact.evidence.length === 0) out.push(`${where}: accepted without evidence`);
    if (!fact.review.by) out.push(`${where}: accepted without a reviewer`);
  }
  return out;
}

/** Checks parsed JSON. Returns the file or the list of problems. */
export function checkTimelineFile(
  data: unknown,
): { ok: true; file: TimelineFile } | { ok: false; problems: string[] } {
  const parsed = timelineFileSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => `${i.path.join('.') || 'file'}: ${i.message}`),
    };
  }
  const problems = timelineProblems(parsed.data);
  return problems.length ? { ok: false, problems } : { ok: true, file: parsed.data };
}

/** The runtime view of a timeline file; `version` is a hash of its contents. */
export function toTimeline(file: TimelineFile, version: string): Timeline {
  const frames = new Map(file.frames.map((f) => [f.id, f.atSec]));
  const facts: TimedFact[] = file.facts.map((f) => ({
    id: f.id,
    startSec: f.startSec,
    revealSec: f.revealSec,
    kind: f.kind,
    text: f.text,
    entities: f.entities,
    spoilerTerms: f.spoilerTerms,
    evidence: f.evidence.map((ref) => ({ ref, atSec: frames.get(ref) ?? f.revealSec })),
    confidence: f.confidence,
    review: f.review.status,
  }));
  const entities = file.entities.map((e) => ({
    id: e.id,
    name: e.name,
    aliases: e.aliases,
    firstSeenSec: e.firstSeenSec,
    intro: e.intro,
    review: e.review.status,
  }));
  return { contentId: file.contentId, version, durationSec: file.durationSec, facts, entities };
}

/**
 * The film's timeline from content/timelines/<id>.json, or an empty one (Pip then abstains).
 * A file that fails its checks stops the server with every problem listed.
 */
export function loadTimeline(timelinesDir: string, film: Content): Timeline {
  const file = join(timelinesDir, `${film.id}.json`);
  if (!existsSync(file)) return emptyTimeline(film.id, film.durationSec);
  const text = readFileSync(file, 'utf8');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return exitWith(file, [error instanceof Error ? error.message : String(error)]);
  }
  const checked = checkTimelineFile(data);
  if (!checked.ok) return exitWith(file, checked.problems);
  if (checked.file.contentId !== film.id)
    return exitWith(file, ['contentId does not match the film']);
  const version = createHash('sha256').update(text).digest('hex').slice(0, 12);
  return toTimeline(checked.file, version);
}

function exitWith(file: string, problems: string[]): never {
  console.error(`Invalid timeline ${file}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
