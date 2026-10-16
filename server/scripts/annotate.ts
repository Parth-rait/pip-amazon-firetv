// npm run annotate -- <film-id> [--model qwen3-vl:4b-instruct] [--every 3] [--limit N]
// Offline step 1 of the film memory (docs/vnext/PLAN.md 7 and 10): sample frames from
// server/media/<film-id>.mp4 (one every few seconds, plus one just after each cut), ask a local
// vision model through Ollama to describe each one, and append one candidate per frame to
// content/annotations/<film-id>/candidates.<model>.<prompt>.jsonl. Candidates are model output with
// their provenance and are never edited; scene records are drafted from them and then reviewed.
// Resumable: frames already in the file are skipped. Free: everything runs on this machine.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig } from '../src/config.js';
import {
  ANNOTATION_SCHEMA_VERSION,
  candidatesPath,
  frameId,
  parseFrameDescription,
  PROMPT_VERSION,
  sampleTimes,
  type FrameCandidate,
} from '../src/film/annotation.js';

const PROMPT =
  'Describe this frame from an animated short film for a scene log. Reply with JSON only: ' +
  '{"summary": one or two sentences, "people": [up to 4 short descriptions of the most important ' +
  'visible people or creatures], "objects": [up to 4 important objects], "actions": [up to 3 short ' +
  'verb phrases], "setting": short phrase, "text_on_screen": string or null}. ' +
  'Describe only what is visible; do not guess names or story.';
const FRAME_WIDTH = 448;
const CUT_THRESHOLD = 0.3;
const MAX_TOKENS = 300;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function run(cmd: string, args: string[]): { stdout: string; stderr: string } {
  const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${cmd} failed: ${result.stderr.slice(-400)}`);
  return { stdout: result.stdout, stderr: result.stderr };
}

const filmId = process.argv[2];
if (!filmId || filmId.startsWith('--')) {
  console.error('usage: npm run annotate -- <film-id> [--model <ollama vision model>] [--every 3]');
  process.exit(2);
}
const model = arg('model') ?? 'qwen3-vl:4b-instruct';
const everySec = Number(arg('every') ?? 3);
const limit = Number(arg('limit') ?? Number.POSITIVE_INFINITY);
const config = loadConfig();
const film = `media/${filmId}.mp4`;
if (!existsSync(film)) {
  console.error(`no film at server/${film}`);
  process.exit(1);
}

const durationSec = Number(
  run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', film]).stdout,
);
// showinfo prints one line per frame that passed the scene-change filter, on stderr.
const cutsSec = [
  ...run('ffmpeg', [
    '-hide_banner',
    '-i',
    film,
    '-vf',
    `select='gt(scene,${CUT_THRESHOLD})',showinfo`,
    '-an',
    '-f',
    'null',
    '-',
  ]).stderr.matchAll(/pts_time:([0-9.]+)/g),
].map((m) => Number(m[1]));
const times = sampleTimes(durationSec, cutsSec, everySec);

// The model's exact build, so a later run with a changed model is not mistaken for this one.
const tags = (await (await fetch(`${config.OLLAMA_URL}/api/tags`)).json()) as {
  models: { name: string; digest: string }[];
};
const digest = tags.models.find((m) => m.name === model)?.digest;
if (!digest) {
  console.error(`${model} is not installed in Ollama (ollama pull ${model})`);
  process.exit(1);
}

const out = candidatesPath(filmId, model);
mkdirSync(dirname(out), { recursive: true });
const done = new Set(
  existsSync(out)
    ? readFileSync(out, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => (JSON.parse(line) as FrameCandidate).frame_id)
    : [],
);
const frames = `media/frames/${filmId}`;
mkdirSync(frames, { recursive: true });

console.log(
  `${filmId}: ${durationSec.toFixed(1)} s, ${cutsSec.length} cuts, ${times.length} frames ` +
    `(${done.size} already done), model ${model} ${digest.slice(0, 12)}`,
);
let count = 0;
for (const t of times) {
  const id = frameId(t);
  if (done.has(id) || count >= limit) continue;
  count += 1;
  const image = `${frames}/${id}.jpg`;
  if (!existsSync(image)) {
    run('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(t),
      '-i',
      film,
      '-frames:v',
      '1',
      '-vf',
      `scale=${FRAME_WIDTH}:-2`,
      image,
    ]);
  }
  const started = Date.now();
  const res = await fetch(`${config.OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: PROMPT,
      images: [readFileSync(image).toString('base64')],
      stream: false,
      format: 'json',
      think: false,
      keep_alive: '10m',
      options: { temperature: 0, num_predict: MAX_TOKENS },
    }),
  });
  const body = (await res.json()) as { response?: string; error?: string };
  const raw = body.response ?? '';
  const parsed = parseFrameDescription(raw);
  const candidate: FrameCandidate = {
    schema_version: ANNOTATION_SCHEMA_VERSION,
    content_id: filmId,
    frame_id: id,
    t_sec: t,
    model,
    model_digest: digest,
    prompt_version: PROMPT_VERSION,
    created_at: new Date().toISOString(),
    ms: Date.now() - started,
    raw_output: raw || (body.error ?? ''),
    parsed: parsed.ok ? parsed.value : null,
    parse_error: parsed.ok ? null : parsed.error,
  };
  appendFileSync(out, `${JSON.stringify(candidate)}\n`);
  const summary = parsed.ok ? parsed.value.summary : `PARSE ERROR ${parsed.error}`;
  console.log(`${id}  ${(candidate.ms / 1000).toFixed(1)} s  ${summary.slice(0, 100)}`);
}
console.log(`done: ${count} new frames in ${out}`);
