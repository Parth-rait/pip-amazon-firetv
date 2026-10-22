// How well the scene memory found and followed characters, against hand labels
// (pipeline/truth/<asset>.characters.json). Each track takes the label it most often shares a
// frame with (see below); then every link in a labelled frame is right (its label is on screen), wrong, or
// not counted (only a "maybe" there).
import { z } from 'zod';
import type { SceneMemory } from './scene-memory.js';

export const characterTruthSchema = z.object({
  schemaVersion: z.literal(1),
  assetId: z.string(),
  labelledBy: z.string(),
  characters: z.record(z.string(), z.string()),
  frames: z.array(
    z.object({
      id: z.string(),
      atSec: z.number(),
      present: z.array(z.string()),
      maybe: z.array(z.string()).optional(),
    }),
  ),
});
export type CharacterTruth = z.infer<typeof characterTruthSchema>;

export interface TrackingScore {
  labelledFrames: number;
  /** Frames with someone on screen where the model saw someone, and empty frames it left empty. */
  presence: { seen: number; missed: number; invented: number; emptyKept: number };
  /** Links in labelled frames whose track's label is on screen there. */
  links: { right: number; wrong: number; precision: number };
  /** Labelled characters (frame by frame) that some link covered. */
  recall: number;
  trackLabels: Record<string, string>; // track id -> majority label
  fragments: Record<string, string[]>; // label -> its tracks
  names: Record<string, string>; // name -> label of the track it went to
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 1000);

export function scoreTracking(
  memory: SceneMemory,
  truth: CharacterTruth,
  names: Map<string, string> = new Map(), // name -> track id
): TrackingScore {
  const byFrame = new Map(memory.sightings.map((s) => [s.frame.id, s]));
  const labelled = truth.frames.filter((f) => byFrame.has(f.id));
  // Label tracks from unambiguous frames first (one character, one link), then the rest from
  // shared frames, leaving out labels the frame's other tracks already have.
  const trackLabels: Record<string, string> = {};
  const vote = (shared: boolean) => {
    const votes = new Map<string, Map<string, number>>();
    for (const f of labelled) {
      const links = byFrame.get(f.id)?.links ?? [];
      if (!shared && (links.length !== 1 || f.present.length !== 1)) continue;
      for (const link of links) {
        if (trackLabels[link.trackId]) continue;
        const taken = new Set(links.filter((l) => l !== link).map((l) => trackLabels[l.trackId]));
        const tally = votes.get(link.trackId) ?? new Map<string, number>();
        for (const label of f.present.filter((p) => !taken.has(p)))
          tally.set(label, (tally.get(label) ?? 0) + 1);
        votes.set(link.trackId, tally);
      }
    }
    for (const [track, tally] of votes) {
      const best = [...tally].sort((a, b) => b[1] - a[1])[0];
      if (best) trackLabels[track] = best[0];
    }
  };
  vote(false);
  vote(true);
  // A track seen in labelled frames that never matched a label is someone who is not there.
  for (const f of labelled)
    for (const l of byFrame.get(f.id)?.links ?? []) trackLabels[l.trackId] ??= 'nobody';
  const presence = { seen: 0, missed: 0, invented: 0, emptyKept: 0 };
  let right = 0;
  let wrong = 0;
  let covered = 0;
  let characters = 0;
  for (const f of labelled) {
    const links = byFrame.get(f.id)?.links ?? [];
    if (f.present.length > 0) presence[links.length > 0 ? 'seen' : 'missed'] += 1;
    else if (links.length > 0 && !f.maybe?.length) presence.invented += 1;
    else presence.emptyKept += 1;
    const labels = new Set(links.map((l) => trackLabels[l.trackId] ?? 'nobody'));
    for (const link of links) {
      const label = trackLabels[link.trackId] ?? 'nobody';
      if (f.present.includes(label)) right += 1;
      else if (!f.maybe?.includes(label)) wrong += 1;
    }
    characters += f.present.length;
    covered += f.present.filter((p) => labels.has(p)).length;
  }
  const fragments: Record<string, string[]> = {};
  for (const [track, label] of Object.entries(trackLabels)) (fragments[label] ??= []).push(track);
  return {
    labelledFrames: labelled.length,
    presence,
    links: { right, wrong, precision: ratio(right, right + wrong) },
    recall: ratio(covered, characters),
    trackLabels,
    fragments,
    names: Object.fromEntries(
      [...names].map(([name, track]) => [name, trackLabels[track] ?? 'unlabelled']),
    ),
  };
}
