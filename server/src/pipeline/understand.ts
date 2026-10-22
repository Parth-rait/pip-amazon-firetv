// Runs the vision model over a film's sampled frames in story order, feeding each answer to the
// scene memory, and asks it which character a heard name belongs to. Every reply is cached per
// frame (or per name check) with its prompt and the model's digest, so an interrupted run resumes
// and a finished run can be replayed exactly without the model.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CandidatesFile } from './artifacts.js';
import { finalizeCandidates, SceneMemory, type Naming, type SampledFrame } from './scene-memory.js';
import { firstHeard, nameMentions, type NameMention, type TranscriptLine } from './transcript.js';
import {
  framePrompt,
  namingPrompt,
  parseNaming,
  parseObservation,
  promptHash,
  VLM_PROMPT_VERSION,
  type VisionModel,
} from './vlm.js';

/** One model reply, as cached and as committed in pipeline/understanding/<asset>.observations.json. */
export interface FrameRecord {
  frameId: string;
  atSec: number;
  sceneId: string | null;
  rosterIds: string[]; // the ids the prompt offered, so a replay parses "match" the same way
  promptVersion: string;
  promptHash: string;
  raw: string;
  ms: number;
}

function cached<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null;
}

function store(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** pipeline/understanding/<asset>.observations.json: everything the model said in one run. */
export interface UnderstandingRecording {
  schemaVersion: 1;
  assetId: string;
  model: string;
  digest: string;
  coveredUntilSec: number; // the last frame the model looked at; later scenes are not described
  frames: FrameRecord[];
  namings: Naming[];
  known: string[];
}

/**
 * The candidates a recorded run gives, without the model: the same memory, names and facts as the
 * run itself, so the scene memory can change and be re-run, and tests use the real Sintel output.
 */
export function candidatesFromRecording(
  recording: UnderstandingRecording,
  input: {
    lines: TranscriptLine[];
    scenes: { id: string; startSec: number; endSec: number }[];
    createdAt: string;
    method: string;
  },
): { candidates: CandidatesFile; memory: SceneMemory } {
  const memory = new SceneMemory();
  replayFrames(memory, recording.frames);
  const candidates = finalizeCandidates({
    assetId: recording.assetId,
    generator: `pip-video-understanding/1 ${recording.model}@${recording.digest.slice(0, 12)}`,
    createdAt: input.createdAt,
    method: input.method,
    memory,
    scenes: input.scenes,
    lines: input.lines,
    heard: firstHeard(nameMentions(input.lines)),
    namings: recording.namings,
    knownNames: new Map(recording.known.map((name) => [name, 0])),
    coveredUntilSec: recording.coveredUntilSec,
  });
  return { candidates, memory };
}

/** Feeds recorded replies to a fresh memory: the same result as the run that recorded them. */
export function replayFrames(memory: SceneMemory, records: FrameRecord[]): void {
  for (const r of records) {
    memory.observe(
      { id: r.frameId, atSec: r.atSec, sceneId: r.sceneId },
      parseObservation(r.raw, r.rosterIds),
    );
  }
}

export async function understandFrames(options: {
  vision: VisionModel;
  memory: SceneMemory;
  frames: (SampledFrame & { image: string })[];
  cacheDir: string;
  log: (line: string) => void;
  offline?: boolean; // only cached replies: stop at the first frame the model has not seen
}): Promise<FrameRecord[]> {
  const { vision, memory } = options;
  mkdirSync(options.cacheDir, { recursive: true });
  const records: FrameRecord[] = [];
  for (const [i, frame] of options.frames.entries()) {
    const path = join(options.cacheDir, `${frame.id}.json`);
    let record = cached<FrameRecord & { digest: string }>(path);
    const stale =
      !record || record.digest !== vision.digest || record.promptVersion !== VLM_PROMPT_VERSION;
    if (stale && options.offline) {
      options.log(`offline: stopping at ${frame.id}, the first frame without a cached reply`);
      break;
    }
    if (!record || stale) {
      const roster = memory.roster(frame.atSec);
      const prompt = framePrompt(roster);
      const { raw, ms } = await askWithRetry(
        vision,
        prompt,
        readFileSync(frame.image),
        options.log,
      );
      record = {
        frameId: frame.id,
        atSec: frame.atSec,
        sceneId: frame.sceneId,
        rosterIds: roster.map((r) => r.id),
        promptVersion: VLM_PROMPT_VERSION,
        promptHash: promptHash(prompt),
        raw,
        ms,
        digest: vision.digest,
      };
      store(path, record);
      const obs = parseObservation(raw, record.rosterIds);
      const who = obs?.characters.map((c) => c.match ?? `new:${c.looks}`).join('; ') ?? 'UNPARSED';
      options.log(
        `${String(i + 1).padStart(3)}/${options.frames.length} ${frame.id} ${(ms / 1000).toFixed(1)}s ${who} | ${obs?.action.slice(0, 70) ?? ''}`,
      );
    }
    records.push({
      frameId: record.frameId,
      atSec: record.atSec,
      sceneId: record.sceneId,
      rosterIds: record.rosterIds,
      promptVersion: record.promptVersion,
      promptHash: record.promptHash,
      raw: record.raw,
      ms: record.ms,
    });
    memory.observe(
      { id: frame.id, atSec: frame.atSec, sceneId: frame.sceneId },
      parseObservation(record.raw, record.rosterIds),
    );
  }
  return records;
}

/**
 * One retry after a failure (on an 8 GB Mac a call now and then stalls past the timeout); a second
 * failure is recorded as an empty reply, so the frame counts as unreadable and the run goes on.
 */
async function askWithRetry(
  vision: VisionModel,
  prompt: string,
  jpeg: Buffer,
  log: (line: string) => void,
): Promise<{ raw: string; ms: number }> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await vision.ask(prompt, jpeg);
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      log(`  model call failed (attempt ${attempt}): ${why}`);
      if (attempt >= 2) return { raw: '', ms: 0 };
    }
  }
}

const NAME_WINDOW_SEC = 4;
const MAX_CHECKS_PER_NAME = 3;

/**
 * For each spoken name, shows the model the frame at that line and the characters seen around it,
 * and asks who is called that. Stops checking a name once it is matched.
 */
export async function nameCharacters(options: {
  vision: VisionModel;
  memory: SceneMemory;
  lines: TranscriptLine[];
  mentions: NameMention[];
  imageOf: (frameId: string) => string;
  cacheDir: string;
  log: (line: string) => void;
  offline?: boolean; // only cached answers; an unasked name stays unmatched
}): Promise<Naming[]> {
  const { vision, memory } = options;
  const lineById = new Map(options.lines.map((l) => [l.id, l]));
  const namings: Naming[] = [];
  const checks = new Map<string, number>();
  const matched = new Set<string>();
  for (const mention of options.mentions) {
    const line = lineById.get(mention.lineId);
    if (!line || matched.has(mention.name)) continue;
    if ((checks.get(mention.name) ?? 0) >= MAX_CHECKS_PER_NAME) continue;
    const near = memory.sightings.filter(
      (s) =>
        s.frame.atSec >= line.startSec - NAME_WINDOW_SEC &&
        s.frame.atSec <= line.endSec + NAME_WINDOW_SEC,
    );
    const ids = [...new Set(near.flatMap((s) => s.links.map((l) => l.trackId)))];
    // The frame closest to the end of the line that shows any of them.
    const frame = [...near]
      .filter((s) => s.links.length > 0)
      .sort(
        (a, b) => Math.abs(a.frame.atSec - line.endSec) - Math.abs(b.frame.atSec - line.endSec),
      )[0];
    if (!frame || ids.length === 0) {
      namings.push({ name: mention.name, lineId: line.id, trackId: null });
      continue;
    }
    checks.set(mention.name, (checks.get(mention.name) ?? 0) + 1);
    const roster = memory.describeTracks(ids);
    const prompt = namingPrompt(line.text, mention.name, roster);
    const path = join(options.cacheDir, `name-${line.id}-${mention.name}.json`);
    let record = cached<{ raw: string; digest: string; hash: string }>(path);
    const fresh = record && record.digest === vision.digest && record.hash === promptHash(prompt);
    if (!fresh && options.offline) {
      namings.push({ name: mention.name, lineId: line.id, trackId: null });
      continue;
    }
    if (!record || !fresh) {
      const { raw } = await askWithRetry(
        vision,
        prompt,
        readFileSync(options.imageOf(frame.frame.id)),
        options.log,
      );
      record = { raw, digest: vision.digest, hash: promptHash(prompt) };
      store(path, { ...record, prompt, frameId: frame.frame.id });
    }
    const answer = parseNaming(
      record.raw,
      roster.map((r) => r.id),
    );
    options.log(`name ${mention.name} at ${line.endSec.toFixed(1)}s -> ${answer.who ?? 'unknown'}`);
    namings.push({ name: mention.name, lineId: line.id, trackId: answer.who });
    if (answer.who) matched.add(mention.name);
  }
  return namings;
}
