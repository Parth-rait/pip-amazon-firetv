// Turns candidates plus a person's review into the canonical timeline file. Every fact keeps its
// generator, evidence and review state; only accepted facts reach people at runtime.
import { TIMELINE_SCHEMA_VERSION, type TimelineFile } from '../film/timeline-file.js';
import type { Asset, CandidatesFile, FramesFile, ReviewFile, ScenesFile } from './artifacts.js';

export interface ExportInput {
  asset: Pick<Asset, 'assetId' | 'sha256' | 'license' | 'rights'>;
  contentId: string;
  durationSec: number;
  scenes: ScenesFile['scenes'];
  frames: FramesFile['frames'];
  candidates: CandidatesFile;
  review: ReviewFile | null;
}

function sceneAt(scenes: ScenesFile['scenes'], sec: number): string | undefined {
  return scenes.find((s) => sec >= s.startSec && sec < s.endSec)?.id;
}

/** The timeline file for export. Unreviewed items stay `candidate` with no reviewer. */
export function buildTimelineFile(input: ExportInput): TimelineFile {
  const { candidates, review } = input;
  const decide = (key: string) => {
    const decision = review?.decisions[key];
    return {
      status: decision?.status ?? ('candidate' as const),
      by: decision ? (review?.reviewer ?? null) : null,
      at: decision ? (review?.reviewedAt ?? null) : null,
      ...(decision?.note ? { note: decision.note } : {}),
    };
  };
  const facts = candidates.facts
    .map((fact) => {
      const edit = review?.edits[fact.id] ?? {};
      const startSec = edit.startSec ?? fact.startSec;
      return {
        ...fact,
        ...edit,
        startSec,
        sceneId: sceneAt(input.scenes, startSec),
        generator: candidates.generator,
        review: decide(fact.id),
      };
    })
    .sort((a, b) => a.startSec - b.startSec);
  return {
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    contentId: input.contentId,
    durationSec: input.durationSec,
    source: {
      assetId: input.asset.assetId,
      sha256: input.asset.sha256,
      license: input.asset.license,
      rights: input.asset.rights,
    },
    frames: input.frames.map((f) => ({ id: f.id, atSec: f.atSec, path: f.path })),
    scenes: input.scenes,
    entities: candidates.entities.map((e) => ({ ...e, review: decide(`entity:${e.id}`) })),
    facts,
  };
}

/** Items still waiting for a decision, for `pipeline review --list`. */
export function pendingReview(candidates: CandidatesFile, review: ReviewFile | null): string[] {
  const decided = new Set(Object.keys(review?.decisions ?? {}));
  return [
    ...candidates.entities.map((e) => `entity:${e.id}`),
    ...candidates.facts.map((f) => f.id),
  ].filter((key) => !decided.has(key));
}
