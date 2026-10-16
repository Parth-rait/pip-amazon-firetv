// Offline film annotation (docs/vnext/PLAN.md 7, 10 and 11): which frames to sample, and the
// candidate record a vision model's description becomes. Candidates keep their provenance (model,
// exact build, prompt version, raw output) and are never edited; reviewed scene records are made
// from them separately, so a correction never rewrites what the model said.
import { z } from 'zod';

export const ANNOTATION_SCHEMA_VERSION = 1;
export const PROMPT_VERSION = 'p1';
const FIRST_SEC = 1; // the first frames are often black
const END_MARGIN_SEC = 0.5;
const AFTER_CUT_SEC = 0.5;
const MIN_GAP_SEC = 1;

const descriptionSchema = z.object({
  summary: z.string().min(1).max(600),
  people: z.array(z.string().min(1)).max(8).default([]),
  objects: z.array(z.string().min(1)).max(8).default([]),
  actions: z.array(z.string().min(1)).max(8).default([]),
  setting: z.string().default(''),
  text_on_screen: z.string().nullable().default(null),
});
export type FrameDescription = z.infer<typeof descriptionSchema>;

export interface FrameCandidate {
  schema_version: number;
  content_id: string;
  frame_id: string; // "f0040.5": the frame at 40.5 s, so it can be made again from the film
  t_sec: number;
  model: string;
  model_digest: string;
  prompt_version: string;
  created_at: string;
  ms: number;
  raw_output: string;
  parsed: FrameDescription | null;
  parse_error: string | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The frame's id from its time: "f0040.5". Sorts in time order as text. */
export function frameId(tSec: number): string {
  return `f${round1(tSec).toFixed(1).padStart(6, '0')}`;
}

/**
 * When to sample: every `everySec` seconds, and just after each cut so every shot has a frame.
 * A regular sample within 1 s of a cut's frame is dropped; the cut's frame is kept.
 */
export function sampleTimes(durationSec: number, cutsSec: number[], everySec: number): number[] {
  const last = durationSec - END_MARGIN_SEC;
  const afterCuts = cutsSec
    .map((c) => round1(c + AFTER_CUT_SEC))
    .filter((t) => t >= FIRST_SEC && t <= last);
  const regular: number[] = [];
  for (let t = FIRST_SEC; t <= last; t += everySec) {
    const r = round1(t);
    if (afterCuts.every((c) => Math.abs(c - r) >= MIN_GAP_SEC)) regular.push(r);
  }
  return [...new Set([...regular, ...afterCuts])].sort((a, b) => a - b);
}

/** Parses a model's reply; models sometimes wrap JSON in prose or code fences. */
export function parseFrameDescription(
  raw: string,
): { ok: true; value: FrameDescription } | { ok: false; error: string } {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, error: 'no JSON object' };
  let json: unknown;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  // Small models sometimes give people as objects ({"description": ...}); keep their text.
  if (json && typeof json === 'object') {
    for (const key of ['people', 'objects', 'actions'] as const) {
      const list = (json as Record<string, unknown>)[key];
      if (Array.isArray(list)) {
        (json as Record<string, unknown>)[key] = list
          .map((item) =>
            typeof item === 'string'
              ? item
              : item && typeof item === 'object'
                ? Object.values(item as Record<string, unknown>)
                    .filter((v) => typeof v === 'string')
                    .join(': ')
                : '',
          )
          .filter(Boolean)
          .slice(0, 8);
      }
    }
  }
  const parsed = descriptionSchema.safeParse(json);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid shape' };
}

/** Where a model's candidates for a film are kept, relative to server/. */
export function candidatesPath(filmId: string, model: string): string {
  const slug = model.replace(/[^a-z0-9.]+/gi, '-').toLowerCase();
  return `content/annotations/${filmId}/candidates.${slug}.${PROMPT_VERSION}.jsonl`;
}
