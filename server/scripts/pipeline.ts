// npm run pipeline -- <stage> <asset id> [options]: the offline video data pipeline.
// Stages: ingest, probe, scenes, frames, sheets, asr, understand, annotate, review, export,
// validate, dataset, all (ingest to asr). Work files go to data/<asset>/ (gitignored); reviewed outputs are
// committed. See docs/architecture/video-data-pipeline.md.
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { ZodType } from 'zod';
import { loadConfig } from '../src/config.js';
import { checkTimelineFile, toTimeline } from '../src/film/timeline-file.js';
import {
  asrFileSchema,
  assetSchema,
  candidatesFileSchema,
  framesFileSchema,
  probeSchema,
  reviewFileSchema,
  scenesFileSchema,
  type Asset,
  type FramesFile,
} from '../src/pipeline/artifacts.js';
import { buildDataset, toJsonl } from '../src/pipeline/dataset.js';
import {
  boundaryScore,
  cutsAt,
  fixedScenes,
  samplePlan,
  scenesFromCuts,
  sweepThresholds,
} from '../src/pipeline/media-math.js';
import {
  detectChanges,
  extractFrame,
  hasFilter,
  hasMediaTools,
  probeFile,
  sha256File,
  tileSheets,
} from '../src/pipeline/media-tools.js';
import { annotateWithNova } from '../src/pipeline/nova-annotate.js';
import { buildTimelineFile, pendingReview } from '../src/pipeline/review.js';
import { SceneMemory } from '../src/pipeline/scene-memory.js';
import { extractAudio, transcribe, whisperCommit, whisperSetup } from '../src/pipeline/speech.js';
import { characterTruthSchema, scoreTracking } from '../src/pipeline/tracking-score.js';
import { nameMentions } from '../src/pipeline/transcript.js';
import {
  candidatesFromRecording,
  nameCharacters,
  understandFrames,
  type UnderstandingRecording,
} from '../src/pipeline/understand.js';
import { ollamaVision, type VisionModel } from '../src/pipeline/vlm.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(SERVER, '..');
const FONTS = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
];

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    source: { type: 'string' },
    license: { type: 'string' },
    rights: { type: 'string' },
    threshold: { type: 'string', default: '3' },
    'event-floor': { type: 'string', default: '0.5' },
    'min-scene': { type: 'string', default: '1.5' },
    baseline: { type: 'string', default: '6' },
    truth: { type: 'string' },
    every: { type: 'string', default: '2' },
    offset: { type: 'string', default: '0.5' },
    cols: { type: 'string', default: '4' },
    rows: { type: 'string', default: '3' },
    generator: { type: 'string', default: 'manual' },
    content: { type: 'string' },
    timeline: { type: 'string' },
    out: { type: 'string' },
    list: { type: 'boolean', default: false },
    model: { type: 'string', default: 'qwen3-vl:4b-instruct' },
    limit: { type: 'string' },
    known: { type: 'string', multiple: true }, // names the viewer has before the film
    replay: { type: 'boolean', default: false }, // understand: rebuild from the recorded run
    'cached-only': { type: 'boolean', default: false }, // understand: no model calls, cached frames only
  },
});
const [stage, assetId] = positionals;

const dataDir = (id: string) => join(SERVER, 'data', id);
const write = (path: string, data: unknown) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${relative(SERVER, path)}`);
};
function read<T>(path: string, schema: ZodType<T>): T {
  if (!existsSync(path)) fail(`missing ${relative(SERVER, path)}; run the earlier stage first`);
  const parsed = schema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.success)
    fail(`${relative(SERVER, path)} is invalid: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}
function fail(message: string): never {
  console.error(`pipeline: ${message}`);
  process.exit(1);
}
const num = (value: string | undefined) => Number(value);

/** Every stage starts here: the asset must exist and its file must be unchanged. */
async function loadAsset(id: string): Promise<Asset> {
  const asset = read(join(dataDir(id), 'asset.json'), assetSchema);
  const file = resolve(SERVER, asset.file);
  if (!existsSync(file)) fail(`media file ${asset.file} is missing`);
  if ((await sha256File(file)) !== asset.sha256)
    fail(`${asset.file} changed since ingest; ingest it again`);
  return asset;
}

async function ingest(id: string): Promise<void> {
  if (!values.source || !values.license || !values.rights) {
    fail(
      'ingest needs --source <file>, --license <licence> and --rights "<who owns it and why we may use it>"',
    );
  }
  const file = resolve(SERVER, values.source);
  if (!existsSync(file)) fail(`no file at ${values.source}`);
  const asset: Asset = {
    schemaVersion: 1,
    assetId: id,
    source: values.source,
    file: relative(SERVER, file),
    sha256: await sha256File(file),
    bytes: statSync(file).size,
    license: values.license,
    rights: values.rights,
    ingestedAt: new Date().toISOString(),
  };
  write(join(dataDir(id), 'asset.json'), assetSchema.parse(asset));
}

async function probe(id: string): Promise<void> {
  const asset = await loadAsset(id);
  write(join(dataDir(id), 'probe.json'), probeFile(resolve(SERVER, asset.file)));
}

async function scenes(id: string): Promise<void> {
  const asset = await loadAsset(id);
  const info = read(join(dataDir(id), 'probe.json'), probeSchema);
  const threshold = num(values.threshold);
  const events = detectChanges(resolve(SERVER, asset.file), num(values['event-floor'])).map(
    (e) => ({
      timeSec: Math.round((e.timeSec - info.startTimeSec) * 1000) / 1000,
      score: e.score,
    }),
  );
  const cuts = cutsAt(events, threshold);
  const file = {
    schemaVersion: 1 as const,
    method: `ffmpeg-scdet threshold=${threshold} min-scene=${values['min-scene']}s`,
    events,
    cutsSec: cuts,
    scenes: scenesFromCuts(cuts, info.durationSec, num(values['min-scene'])),
    baseline: {
      method: `fixed every ${values.baseline}s`,
      scenes: fixedScenes(info.durationSec, num(values.baseline)),
    },
  };
  write(join(dataDir(id), 'scenes.json'), file);
  console.log(`${file.scenes.length} scenes from ${cuts.length} cuts`);
  if (values.truth) {
    const truth = JSON.parse(readFileSync(resolve(SERVER, values.truth), 'utf8')) as {
      sceneCutsSec: number[];
    };
    const detected = boundaryScore(
      file.scenes.slice(1).map((s) => s.startSec),
      truth.sceneCutsSec,
      0.5,
    );
    const baseline = boundaryScore(
      file.baseline.scenes.slice(1).map((s) => s.startSec),
      truth.sceneCutsSec,
      0.5,
    );
    const sweep = sweepThresholds(events, truth.sceneCutsSec, [1, 2, 3, 4, 5, 6, 8, 10], 0.5);
    const report = { tolerance: 0.5, threshold, detected, baseline, sweep };
    for (const row of sweep)
      console.log(
        `  threshold ${row.threshold}: precision ${row.precision.toFixed(2)} recall ${row.recall.toFixed(2)} F1 ${row.f1.toFixed(2)}`,
      );
    write(join(dataDir(id), 'scenes.score.json'), report);
    console.log(
      `vs truth: detected F1 ${detected.f1.toFixed(2)}, baseline F1 ${baseline.f1.toFixed(2)}`,
    );
  }
}

async function frames(id: string): Promise<void> {
  const asset = await loadAsset(id);
  const info = read(join(dataDir(id), 'probe.json'), probeSchema);
  const sceneFile = read(join(dataDir(id), 'scenes.json'), scenesFileSchema);
  const cuts = new Set(sceneFile.cutsSec);
  const eventsSec = sceneFile.events.filter((e) => !cuts.has(e.timeSec)).map((e) => e.timeSec);
  const plan = samplePlan(sceneFile.scenes, {
    everySec: num(values.every),
    sceneOffsetSec: num(values.offset),
    minGapSec: 1,
    eventsSec,
  });
  // Labels need drawtext; without it the thumbnails are unlabelled and the sheets index names them.
  const font = hasFilter('drawtext') ? (FONTS.find((f) => existsSync(f)) ?? null) : null;
  const out: FramesFile = {
    schemaVersion: 1,
    plan: {
      everySec: num(values.every),
      sceneOffsetSec: num(values.offset),
      eventFloor: num(values['event-floor']),
    },
    frames: [],
  };
  for (const item of plan) {
    const image = join(dataDir(id), 'frames', `${item.id}.jpg`);
    const thumb = join(dataDir(id), 'thumbs', `${item.id}.jpg`);
    mkdirSync(dirname(image), { recursive: true });
    mkdirSync(dirname(thumb), { recursive: true });
    const absolute = extractFrame(
      resolve(SERVER, asset.file),
      item.requestedSec + info.startTimeSec,
      {
        image,
        thumb,
        label: `${item.id}  ${item.requestedSec.toFixed(1)}s`,
        font,
      },
    );
    out.frames.push({
      ...item,
      atSec: Math.round((absolute - info.startTimeSec) * 1000) / 1000,
      path: `frames/${item.id}.jpg`,
    });
  }
  write(join(dataDir(id), 'frames.json'), framesFileSchema.parse(out));
  const drift = Math.max(...out.frames.map((f) => Math.abs(f.atSec - f.requestedSec)));
  console.log(
    `${out.frames.length} frames; largest gap between planned and decoded time ${drift.toFixed(3)}s`,
  );
}

function sheets(id: string): void {
  const frameFile = read(join(dataDir(id), 'frames.json'), framesFileSchema);
  const list = join(dataDir(id), 'thumbs', 'list.ffconcat');
  write(
    list,
    ['ffconcat version 1.0', ...frameFile.frames.map((f) => `file '${f.id}.jpg'`)].join('\n') +
      '\n',
  );
  mkdirSync(join(dataDir(id), 'sheets'), { recursive: true });
  tileSheets(
    list,
    num(values.cols),
    num(values.rows),
    join(dataDir(id), 'sheets', 'sheet-%02d.png'),
  );
  const perSheet = num(values.cols) * num(values.rows);
  const index = readdirSync(join(dataDir(id), 'sheets'))
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((file, i) => ({
      file: `sheets/${file}`,
      frames: frameFile.frames
        .slice(i * perSheet, (i + 1) * perSheet)
        .map((f) => ({ id: f.id, atSec: f.atSec })),
    }));
  write(join(dataDir(id), 'sheets', 'index.json'), index);
}

async function asr(id: string): Promise<void> {
  const asset = await loadAsset(id);
  const info = read(join(dataDir(id), 'probe.json'), probeSchema);
  if (info.audio.length === 0) {
    write(join(dataDir(id), 'asr.json'), {
      schemaVersion: 1,
      status: 'skipped',
      reason: 'the file has no audio stream',
      audioStreams: 0,
    });
    return;
  }
  const setup = whisperSetup(REPO);
  if (!existsSync(setup.cli) || !existsSync(setup.model)) {
    write(join(dataDir(id), 'asr.json'), {
      schemaVersion: 1,
      status: 'skipped',
      reason:
        'whisper.cpp is not set up: run video/setup.sh (or set WHISPER_CLI and WHISPER_MODEL)',
      audioStreams: info.audio.length,
    });
    return;
  }
  const wav = join(dataDir(id), 'audio.16k.wav');
  const started = Date.now();
  extractAudio(resolve(SERVER, asset.file), wav);
  const lines = transcribe(setup, wav, join(dataDir(id), 'whisper'));
  const ms = Date.now() - started;
  const file = asrFileSchema.parse({
    schemaVersion: 1,
    status: 'done',
    engine: `whisper.cpp ${whisperCommit(setup)}`,
    model: `${setup.model.split('/').pop()} sha256:${(await sha256File(setup.model)).slice(0, 12)}`,
    ms,
    lines,
  });
  write(join(dataDir(id), 'asr.json'), file);
  console.log(`${lines.length} spoken lines in ${(ms / 1000).toFixed(1)} s`);
}

/** The asset's spoken lines, or none when ASR was skipped or not run. */
function spokenLines(id: string) {
  const path = join(dataDir(id), 'asr.json');
  if (!existsSync(path)) return [];
  const file = read(path, asrFileSchema);
  return file.status === 'done' ? file.lines : [];
}

/**
 * Video understanding: the vision model looks at every sampled frame in story order (cached per
 * frame, so a re-run only asks for new frames), heard names are matched to characters, and the
 * scene memory writes candidate facts to pipeline/annotations/<asset>.candidates.json.
 */
async function understand(id: string): Promise<void> {
  const frameFile = read(join(dataDir(id), 'frames.json'), framesFileSchema);
  const scenesFile = read(join(dataDir(id), 'scenes.json'), scenesFileSchema);
  const lines = spokenLines(id);
  const recordingPath = join(SERVER, 'pipeline', 'understanding', `${id}.observations.json`);
  let recording: UnderstandingRecording;
  if (values.replay) {
    // Rebuild the candidates from the committed run, without the model.
    if (!existsSync(recordingPath)) fail(`no recorded run at ${relative(SERVER, recordingPath)}`);
    recording = JSON.parse(readFileSync(recordingPath, 'utf8')) as UnderstandingRecording;
  } else {
    const offline = values['cached-only'];
    const cacheDir = join(dataDir(id), 'understand', values.model.replace(/[^a-z0-9.]+/gi, '-'));
    const vision = offline
      ? cachedVision(values.model, cacheDir)
      : await ollamaVision(loadConfig().OLLAMA_URL, values.model);
    const frames = frameFile.frames.slice(0, values.limit ? num(values.limit) : undefined);
    const memory = new SceneMemory();
    const records = await understandFrames({
      vision,
      memory,
      frames: frames.map((f) => ({
        id: f.id,
        atSec: f.atSec,
        sceneId: f.sceneId,
        image: join(dataDir(id), f.path),
      })),
      cacheDir,
      log: (line) => console.log(line),
      offline,
    });
    const namings = await nameCharacters({
      vision,
      memory,
      lines,
      mentions: nameMentions(lines),
      imageOf: (frameId) => join(dataDir(id), 'frames', `${frameId}.jpg`),
      cacheDir,
      log: (line) => console.log(line),
      offline,
    });
    recording = {
      schemaVersion: 1,
      assetId: id,
      model: vision.model,
      digest: vision.digest,
      coveredUntilSec: records[records.length - 1]?.atSec ?? 0,
      frames: records,
      namings,
      known: values.known ?? [],
    };
    write(recordingPath, recording);
  }
  const { candidates, memory } = candidatesFromRecording(recording, {
    lines,
    scenes: scenesFile.scenes,
    createdAt: new Date().toISOString(),
    method:
      `${recording.frames.length} frames (scenes.json ${scenesFile.method}) described by ` +
      `${recording.model} with the running character roster; ${lines.length} whisper.cpp lines; ` +
      `${recording.namings.length} name checks`,
  });
  const parsed = candidatesFileSchema.parse(candidates);
  write(join(SERVER, 'pipeline', 'annotations', `${id}.candidates.json`), parsed);
  const named = parsed.entities
    .filter((e) => e.name !== (e.label ?? e.name) || e.aliases.length > 0)
    .map((e) => `${e.id}=${e.name}`);
  console.log(
    `${parsed.entities.length} characters (named: ${named.join(', ') || 'none'}), ` +
      `${parsed.facts.length} candidate facts`,
  );
  const truthPath = join(SERVER, 'pipeline', 'truth', `${id}.characters.json`);
  if (existsSync(truthPath)) {
    const names = new Map(
      parsed.entities.filter((e) => e.aliases.length > 0).map((e) => [e.name, e.id]),
    );
    const score = scoreTracking(memory, read(truthPath, characterTruthSchema), names);
    write(join(dataDir(id), 'understand.score.json'), score);
    console.log(
      `vs ${relative(SERVER, truthPath)}: ${score.labelledFrames} frames, link precision ` +
        `${score.links.precision}, recall ${score.recall}, presence ${JSON.stringify(score.presence)}`,
    );
  }
}

/** The model as the cache knows it: its digest, and no way to ask anything new. */
function cachedVision(model: string, cacheDir: string): VisionModel {
  const first = existsSync(cacheDir)
    ? readdirSync(cacheDir).find((f) => f.startsWith('fr-') && f.endsWith('.json'))
    : undefined;
  if (!first) fail(`no cached replies in ${relative(SERVER, cacheDir)}`);
  const { digest } = JSON.parse(readFileSync(join(cacheDir, first), 'utf8')) as { digest: string };
  return {
    model,
    digest,
    ask: () => Promise.reject(new Error('--cached-only: the model is not asked')),
  };
}

async function annotate(id: string): Promise<void> {
  if (values.generator === 'manual') {
    const path = join(SERVER, 'pipeline', 'annotations', `${id}.candidates.json`);
    const candidates = read(path, candidatesFileSchema);
    const frameIds = new Set([
      ...read(join(dataDir(id), 'frames.json'), framesFileSchema).frames.map((f) => f.id),
      ...spokenLines(id).map((l) => l.id),
    ]);
    const missing = candidates.facts.flatMap((f) =>
      f.evidence.filter((ref) => !frameIds.has(ref)).map((ref) => `${f.id}->${ref}`),
    );
    if (missing.length) fail(`candidates cite frames that were not sampled: ${missing.join(', ')}`);
    console.log(
      `${candidates.facts.length} candidate facts from ${candidates.generator}; every evidence frame exists`,
    );
    return;
  }
  if (values.generator !== 'nova') fail('--generator must be manual or nova');
  const config = loadConfig();
  const index = JSON.parse(readFileSync(join(dataDir(id), 'sheets', 'index.json'), 'utf8')) as {
    file: string;
    frames: { id: string; atSec: number }[];
  }[];
  const candidates = await annotateWithNova({
    region: config.AWS_REGION,
    profile: config.AWS_PROFILE,
    modelId: config.BEDROCK_MODEL_ID,
    assetId: id,
    sheets: index.map((s) => ({ path: join(dataDir(id), s.file), frames: s.frames })),
    timeoutMs: 60_000,
  });
  write(join(dataDir(id), 'candidates.nova.json'), candidates);
  console.log('These are drafts: copy what is right into pipeline/annotations/, then review.');
}

function reviewList(id: string): void {
  const candidates = read(
    join(SERVER, 'pipeline', 'annotations', `${id}.candidates.json`),
    candidatesFileSchema,
  );
  const reviewPath = join(SERVER, 'pipeline', 'reviews', `${id}.review.json`);
  const review = existsSync(reviewPath) ? read(reviewPath, reviewFileSchema) : null;
  const pending = pendingReview(candidates, review);
  for (const key of pending) {
    const fact = candidates.facts.find((f) => f.id === key);
    console.log(
      fact
        ? `${key} [${fact.startSec}-${fact.revealSec}s] ${fact.text}  evidence: ${fact.evidence.join(', ')}`
        : key,
    );
  }
  console.log(`${pending.length} items wait for a decision in ${relative(SERVER, reviewPath)}`);
}

async function exportTimeline(id: string): Promise<void> {
  const asset = await loadAsset(id);
  const info = read(join(dataDir(id), 'probe.json'), probeSchema);
  const reviewPath = join(SERVER, 'pipeline', 'reviews', `${id}.review.json`);
  const file = buildTimelineFile({
    asset,
    contentId: values.content ?? id,
    durationSec: Math.floor(info.durationSec),
    scenes: read(join(dataDir(id), 'scenes.json'), scenesFileSchema).scenes.map((s) => ({
      ...s,
      endSec: Math.min(s.endSec, Math.floor(info.durationSec)),
    })),
    frames: read(join(dataDir(id), 'frames.json'), framesFileSchema).frames,
    lines: spokenLines(id),
    candidates: read(
      join(SERVER, 'pipeline', 'annotations', `${id}.candidates.json`),
      candidatesFileSchema,
    ),
    review: existsSync(reviewPath) ? read(reviewPath, reviewFileSchema) : null,
  });
  const checked = checkTimelineFile(file);
  if (!checked.ok) fail(`the exported timeline is invalid:\n  ${checked.problems.join('\n  ')}`);
  write(resolve(SERVER, values.out ?? join('data', id, 'timeline.json')), file);
  const counts = file.facts.reduce<Record<string, number>>(
    (acc, f) => ({ ...acc, [f.review.status]: (acc[f.review.status] ?? 0) + 1 }),
    {},
  );
  console.log(`facts by review state: ${JSON.stringify(counts)}`);
}

function validate(path: string): void {
  const checked = checkTimelineFile(JSON.parse(readFileSync(resolve(SERVER, path), 'utf8')));
  if (!checked.ok) fail(`${path} is invalid:\n  ${checked.problems.join('\n  ')}`);
  const accepted = checked.file.facts.filter((f) => f.review.status === 'accepted').length;
  console.log(`${path} is valid: ${checked.file.facts.length} facts, ${accepted} accepted`);
}

function dataset(id: string): void {
  if (!values.timeline) fail('dataset needs --timeline <timeline file>');
  const text = readFileSync(resolve(SERVER, values.timeline), 'utf8');
  const checked = checkTimelineFile(JSON.parse(text));
  if (!checked.ok) fail('the timeline is invalid; run validate');
  const examples = buildDataset(
    toTimeline(checked.file, `sha:${(checked.file.source.sha256 ?? 'none').slice(0, 12)}`),
  );
  write(
    resolve(SERVER, values.out ?? join('evals', 'datasets', id, 'v1', 'examples.jsonl')),
    toJsonl(examples),
  );
  console.log(`${examples.length} examples`);
}

async function main(): Promise<void> {
  if (!stage) fail('usage: npm run pipeline -- <stage> <asset id> [options]');
  if (stage === 'validate') return validate(assetId ?? fail('validate needs a timeline path'));
  if (!assetId || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(assetId))
    fail('give an asset id (letters, digits, _ and -)');
  if (['probe', 'scenes', 'frames', 'all'].includes(stage) && !hasMediaTools())
    fail('ffmpeg and ffprobe are needed');
  const stages: Record<string, () => Promise<void> | void> = {
    ingest: () => ingest(assetId),
    probe: () => probe(assetId),
    scenes: () => scenes(assetId),
    frames: () => frames(assetId),
    sheets: () => sheets(assetId),
    asr: () => asr(assetId),
    understand: () => understand(assetId),
    annotate: () => annotate(assetId),
    review: () =>
      values.list
        ? reviewList(assetId)
        : fail('use review --list; decisions go in pipeline/reviews/'),
    export: () => exportTimeline(assetId),
    dataset: () => dataset(assetId),
    all: async () => {
      await ingest(assetId);
      await probe(assetId);
      await scenes(assetId);
      await frames(assetId);
      sheets(assetId);
      await asr(assetId);
    },
  };
  const run = stages[stage];
  if (!run) fail(`unknown stage ${stage}`);
  await run();
}

await main();
