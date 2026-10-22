// The files each pipeline stage writes, with schemas so every stage checks what it reads.
// Raw model or reviewer drafts (candidates) stay separate from the accepted timeline.
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i);
const seconds = z.number().finite().min(0);

/** asset.json: what the media is and the right to use it. Written by `ingest`. */
export const assetSchema = z.object({
  schemaVersion: z.literal(1),
  assetId: id,
  source: z.string().min(1), // where it came from (a path or URL); never fetched again by the pipeline
  file: z.string().min(1), // the local file the stages read, relative to server/
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
  license: z.string().min(1).max(120),
  rights: z.string().min(1).max(400), // the rights note: who owns it and why we may use it
  ingestedAt: z.string(),
});
export type Asset = z.infer<typeof assetSchema>;

/** probe.json: deterministic facts about the file. Written by `probe`. */
export const probeSchema = z.object({
  schemaVersion: z.literal(1),
  durationSec: z.number().positive(),
  startTimeSec: z.number(), // the container's first timestamp; frame times are kept relative to it
  video: z.object({
    codec: z.string(),
    width: z.number().int(),
    height: z.number().int(),
    fps: z.number().positive(),
  }),
  audio: z.array(
    z.object({ codec: z.string(), channels: z.number().int(), language: z.string().nullable() }),
  ),
});
export type Probe = z.infer<typeof probeSchema>;

export const sceneSchema = z.object({ id, startSec: seconds, endSec: seconds });
export type PipelineScene = z.infer<typeof sceneSchema>;

/** scenes.json: proposed boundaries and the fixed-interval baseline. Written by `scenes`. */
export const scenesFileSchema = z.object({
  schemaVersion: z.literal(1),
  method: z.string(), // for example "ffmpeg-scdet threshold=3"
  events: z.array(z.object({ timeSec: seconds, score: z.number() })), // every scored change
  cutsSec: z.array(seconds),
  scenes: z.array(sceneSchema),
  baseline: z.object({ method: z.string(), scenes: z.array(sceneSchema) }),
});
export type ScenesFile = z.infer<typeof scenesFileSchema>;

export const frameSchema = z.object({
  id,
  requestedSec: seconds, // the time the plan asked for
  atSec: seconds, // the decoded frame's own timestamp, never an index
  sceneId: id.nullable(),
  path: z.string(), // relative to the asset's data folder
});
export type PipelineFrame = z.infer<typeof frameSchema>;

/** frames.json: every sampled frame and its exact source time. Written by `frames`. */
export const framesFileSchema = z.object({
  schemaVersion: z.literal(1),
  plan: z.object({
    everySec: z.number().positive(),
    sceneOffsetSec: z.number().min(0),
    eventFloor: z.number(),
  }),
  frames: z.array(frameSchema),
});
export type FramesFile = z.infer<typeof framesFileSchema>;

/** A candidate fact: untrusted until reviewed. */
export const candidateFactSchema = z.object({
  id,
  startSec: seconds,
  revealSec: seconds,
  kind: z.enum(['event', 'appearance', 'setting', 'dialogue', 'relation']),
  text: z.string().min(1).max(300),
  entities: z.array(id).max(8),
  spoilerTerms: z.array(z.string().min(2).max(40)).max(8),
  evidence: z.array(id).min(1).max(8),
  confidence: z.number().min(0).max(1),
});

export const candidateEntitySchema = z.object({
  id,
  name: z.string().min(1).max(60),
  aliases: z.array(z.string().min(1).max(60)).max(8),
  firstSeenSec: seconds,
  intro: z.string().min(1).max(200), // safe at firstSeenSec: never the name when namedSec is later
  label: z.string().min(1).max(60).optional(), // what to call it until its name is heard
  namedSec: seconds.optional(), // when its name is revealed, if after firstSeenSec
});

/** pipeline/annotations/<asset>.candidates.json: what a person or a model proposed. */
export const candidatesFileSchema = z.object({
  schemaVersion: z.literal(1),
  assetId: id,
  generator: z.string().min(1).max(80), // who or what proposed these, with a version
  createdAt: z.string(),
  method: z.string().max(400), // how: which frames or sheets were looked at
  entities: z.array(candidateEntitySchema),
  facts: z.array(candidateFactSchema),
  coveredUntilSec: seconds.optional(), // frames were described up to here (a partial run)
});
export type CandidatesFile = z.infer<typeof candidatesFileSchema>;

const decisionSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'needs-change']),
  note: z.string().max(300).optional(),
});

/** pipeline/reviews/<asset>.review.json: a person's decisions, item by item, with corrections. */
export const reviewFileSchema = z.object({
  schemaVersion: z.literal(1),
  assetId: id,
  reviewer: z.string().min(1).max(80),
  reviewedAt: z.string(),
  decisions: z.record(z.string(), decisionSchema), // keys: fact ids, or "entity:<id>"
  edits: z
    .record(
      z.string(),
      z.object({
        text: z.string().max(300).optional(),
        revealSec: seconds.optional(),
        startSec: seconds.optional(),
      }),
    )
    .default({}),
});
export type ReviewFile = z.infer<typeof reviewFileSchema>;

export const transcriptLineSchema = z.object({
  id,
  startSec: seconds,
  endSec: seconds,
  text: z.string().min(1).max(400),
});

/** asr.json: timestamped dialogue, or why there is none. Written by `asr`. */
export const asrFileSchema = z.discriminatedUnion('status', [
  z.object({
    schemaVersion: z.literal(1),
    status: z.literal('skipped'),
    reason: z.string(),
    audioStreams: z.number().int(),
  }),
  z.object({
    schemaVersion: z.literal(1),
    status: z.literal('done'),
    engine: z.string(), // whisper.cpp and its commit
    model: z.string(), // model file name and sha256
    ms: z.number().int(),
    lines: z.array(transcriptLineSchema),
  }),
]);
export type AsrFile = z.infer<typeof asrFileSchema>;
export type TranscriptLine = z.infer<typeof transcriptLineSchema>;

/** The stable id of a frame from its planned time, so annotations survive a re-run. */
export function frameId(requestedSec: number): string {
  return `fr-${String(Math.round(requestedSec * 10)).padStart(5, '0')}`;
}
