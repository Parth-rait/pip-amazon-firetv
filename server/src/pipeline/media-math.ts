// Pure logic for the media stages: reading ffprobe and ffmpeg output, turning cuts into scenes,
// planning which frames to sample, and scoring boundaries against ground truth.
import type { PipelineScene, Probe } from './artifacts.js';
import { frameId } from './artifacts.js';

/** probe.json from `ffprobe -print_format json -show_format -show_streams`. */
export function parseProbe(json: unknown): Probe {
  const data = json as {
    format?: { duration?: string; start_time?: string };
    streams?: {
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      r_frame_rate?: string;
      channels?: number;
      tags?: { language?: string };
    }[];
  };
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  if (!video) throw new Error('ffprobe found no video stream');
  const duration = Number(data.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('ffprobe found no duration');
  return {
    schemaVersion: 1,
    durationSec: duration,
    startTimeSec: Number(data.format?.start_time ?? 0) || 0,
    video: {
      codec: video.codec_name ?? 'unknown',
      width: video.width ?? 0,
      height: video.height ?? 0,
      fps: parseRate(video.avg_frame_rate) || parseRate(video.r_frame_rate),
    },
    audio: streams
      .filter((s) => s.codec_type === 'audio')
      .map((s) => ({
        codec: s.codec_name ?? 'unknown',
        channels: s.channels ?? 0,
        language: s.tags?.language ?? null,
      })),
  };
}

function parseRate(rate: string | undefined): number {
  const [num, den] = (rate ?? '').split('/').map(Number);
  return num && den ? num / den : 0;
}

export interface ChangeEvent {
  timeSec: number;
  score: number; // scdet's 0 to 100 change score
}

/** Change events from ffmpeg's scdet log ("lavfi.scd.score: 5.9, lavfi.scd.time: 10"). */
export function parseSceneLog(stderr: string): ChangeEvent[] {
  const events = new Map<number, number>();
  for (const m of stderr.matchAll(
    /lavfi\.scd\.score:\s*([0-9.]+),\s*lavfi\.scd\.time:\s*([0-9.]+)/g,
  )) {
    const time = Number(m[2]);
    const score = Number(m[1]);
    if (Number.isFinite(time) && Number.isFinite(score))
      events.set(time, Math.max(score, events.get(time) ?? 0));
  }
  return [...events]
    .map(([timeSec, score]) => ({ timeSec, score }))
    .sort((a, b) => a.timeSec - b.timeSec);
}

/** The events at or above a threshold are cuts; the rest are smaller changes inside scenes. */
export function cutsAt(events: ChangeEvent[], threshold: number): number[] {
  return events.filter((e) => e.score >= threshold).map((e) => e.timeSec);
}

/** F1 of the cuts at each threshold against true cuts, to choose a threshold by measurement. */
export function sweepThresholds(
  events: ChangeEvent[],
  truth: number[],
  thresholds: number[],
  toleranceSec: number,
): { threshold: number; precision: number; recall: number; f1: number }[] {
  return thresholds.map((threshold) => ({
    threshold,
    ...boundaryScore(cutsAt(events, threshold), truth, toleranceSec),
  }));
}

/** The first frame time from ffmpeg's showinfo filter ("pts_time:53.0417"), or null. */
export function parseShowinfoTime(stderr: string): number | null {
  const match = /pts_time:\s*([0-9.]+)/.exec(stderr);
  return match ? Number(match[1]) : null;
}

/** Scenes between cuts, merging any shorter than `minSceneSec` into the one before. */
export function scenesFromCuts(
  cuts: number[],
  durationSec: number,
  minSceneSec: number,
): PipelineScene[] {
  const bounds = [0, ...cuts.filter((c) => c > 0 && c < durationSec), durationSec];
  const kept: number[] = [0];
  for (const b of bounds.slice(1)) {
    const last = kept[kept.length - 1] ?? 0;
    if (b - last >= minSceneSec || b === durationSec) kept.push(b);
  }
  // A too-short final scene joins the previous one.
  if (kept.length > 2 && durationSec - (kept[kept.length - 2] ?? 0) < minSceneSec)
    kept.splice(kept.length - 2, 1);
  return kept.slice(1).map((end, i) => ({
    id: `sc-${String(i + 1).padStart(3, '0')}`,
    startSec: kept[i] ?? 0,
    endSec: end,
  }));
}

/** The fixed-interval baseline (the original six-second idea) to compare detection against. */
export function fixedScenes(durationSec: number, everySec: number): PipelineScene[] {
  const cuts: number[] = [];
  for (let t = everySec; t < durationSec; t += everySec) cuts.push(t);
  return scenesFromCuts(cuts, durationSec, 0);
}

/** Precision and recall of predicted cuts against true cuts, each true cut matched at most once. */
export function boundaryScore(
  predicted: number[],
  truth: number[],
  toleranceSec: number,
): { precision: number; recall: number; f1: number } {
  const unmatched = [...truth];
  let hits = 0;
  for (const p of predicted) {
    const i = unmatched.findIndex((t) => Math.abs(t - p) <= toleranceSec);
    if (i >= 0) {
      hits += 1;
      unmatched.splice(i, 1);
    }
  }
  const precision = predicted.length ? hits / predicted.length : 1;
  const recall = truth.length ? hits / truth.length : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

/**
 * Which moments to sample: shortly after every scene start, then every `everySec` inside each
 * scene. Times closer than `minGapSec` to an earlier one are dropped. Ids come from the times.
 */
export function samplePlan(
  scenes: PipelineScene[],
  options: { everySec: number; sceneOffsetSec: number; minGapSec: number; eventsSec?: number[] },
): { id: string; requestedSec: number; sceneId: string }[] {
  const wanted: { sec: number; sceneId: string; isEvent: boolean }[] = [];
  for (const scene of scenes) {
    for (let t = scene.startSec + options.sceneOffsetSec; t < scene.endSec; t += options.everySec) {
      wanted.push({ sec: Math.round(t * 10) / 10, sceneId: scene.id, isEvent: false });
    }
  }
  // Smaller changes inside a scene (a caption, an object appearing) are often the reveal moments.
  for (const event of options.eventsSec ?? []) {
    const sec = Math.round((event + options.sceneOffsetSec) * 10) / 10;
    const scene = scenes.find((s) => sec >= s.startSec && sec < s.endSec);
    if (scene) wanted.push({ sec, sceneId: scene.id, isEvent: true });
  }
  wanted.sort((a, b) => a.sec - b.sec || Number(b.isEvent) - Number(a.isEvent));
  const plan: { id: string; requestedSec: number; sceneId: string }[] = [];
  for (const w of wanted) {
    const last = plan[plan.length - 1];
    if (last && w.sec - last.requestedSec < options.minGapSec) {
      if (!w.isEvent) continue;
      plan.pop(); // an event frame replaces a regular one that is too close to it
    }
    plan.push({ id: frameId(w.sec), requestedSec: w.sec, sceneId: w.sceneId });
  }
  return plan;
}
