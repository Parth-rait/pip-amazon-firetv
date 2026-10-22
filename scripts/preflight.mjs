// scripts/preflight.mjs
// Checks the demo setup before a rehearsal or a recording (PROJECT.md Step 11) and prints one
// PASS or FAIL line per check. Start the tunnel and the server first. Exits 1 if anything fails.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(root, 'server', 'content');
const FILM_IDS = readdirSync(CONTENT_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.replace(/\.json$/, ''));
const QUIZ_QUESTIONS = 5;
const FETCH_TIMEOUT_MS = 8000;
// smoke:ai fails by itself when Nova takes over 6 s; this only covers npm and tsx starting up.
const SMOKE_KILL_MS = 30_000;
let failed = 0;

function report(ok, name, detail) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`);
}

function readEnv(file) {
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

async function get(url, headers = {}) {
  return fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

const why = (error) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));

function runSmokeAi() {
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', 'smoke:ai', '--prefix', 'server'], { cwd: root });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    const timer = setTimeout(() => child.kill('SIGKILL'), SMOKE_KILL_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output });
    });
  });
}

// 1. Node 22 (ADBT fails on newer versions).
const nodeMajor = Number(process.versions.node.split('.')[0]);
report(nodeMajor === 22, 'Node major version is 22', `found ${process.versions.node}`);

// 2. The public URL answers over HTTPS.
const env = readEnv(join(root, 'server', '.env'));
const publicUrl = (env.PUBLIC_URL ?? '').replace(/\/+$/, '');
let isServerUp = false;
if (!publicUrl.startsWith('https://')) {
  report(
    false,
    'PUBLIC_URL answers /health over HTTPS',
    `PUBLIC_URL is "${publicUrl || 'missing'}"; run npm run tunnel`,
  );
} else {
  try {
    const res = await get(`${publicUrl}/health`);
    const body = res.ok ? await res.json() : null;
    isServerUp = body?.ok === true;
    report(isServerUp, 'PUBLIC_URL answers /health over HTTPS', `${publicUrl} -> ${res.status}`);
  } catch (error) {
    report(false, 'PUBLIC_URL answers /health over HTTPS', `${publicUrl}: ${why(error)}`);
  }
}

// 3. Each film is listed with a full URL, its first 100 bytes come back as a 206, and its
//    poster loads.
if (isServerUp) {
  try {
    const films = await (await get(`${publicUrl}/api/films`)).json();
    for (const id of FILM_IDS) {
      const film = Array.isArray(films) ? films.find((f) => f.id === id) : undefined;
      const hasFullUrl = typeof film?.url === 'string' && film.url.startsWith(`${publicUrl}/`);
      report(hasFullUrl, `/api/films lists ${id} with a full URL`, film?.url ?? 'missing');
      if (!hasFullUrl) continue;
      const res = await get(film.url, { Range: 'bytes=0-99' });
      const type = res.headers.get('content-type') ?? '';
      await res.arrayBuffer();
      report(
        res.status === 206 && type.startsWith('video/mp4'),
        `${id} answers a Range request`,
        `${res.status} ${type}`,
      );
      if (film.poster) {
        const poster = await get(film.poster);
        const posterType = poster.headers.get('content-type') ?? '';
        await poster.arrayBuffer();
        report(
          poster.ok && posterType.startsWith('image/'),
          `${id} has its poster`,
          `${poster.status} ${posterType}`,
        );
      } else {
        report(false, `${id} has its poster`, 'no poster in the film file (PROJECT.md 5.6)');
      }
    }
  } catch (error) {
    report(false, '/api/films lists the films', why(error));
  }
} else {
  report(false, '/api/films and the films', 'skipped: the server did not answer');
}

// 4. Each film file has the checked quiz.
for (const id of FILM_IDS) {
  try {
    const content = JSON.parse(readFileSync(join(CONTENT_DIR, `${id}.json`), 'utf8'));
    const count = Array.isArray(content.quiz) ? content.quiz.length : 0;
    report(
      count === QUIZ_QUESTIONS,
      `${id} has ${QUIZ_QUESTIONS} quiz questions`,
      `found ${count}`,
    );
  } catch (error) {
    report(false, `${id} has ${QUIZ_QUESTIONS} quiz questions`, why(error));
  }
  // Ask Pip answers through the spoiler gate only with a reviewed timeline (npm run timeline:notes).
  try {
    const timeline = JSON.parse(readFileSync(join(CONTENT_DIR, 'timelines', `${id}.json`), 'utf8'));
    const accepted = timeline.facts.filter((f) => f.review?.status === 'accepted').length;
    report(accepted > 0, `${id} has a reviewed timeline`, `${accepted} accepted facts`);
  } catch (error) {
    report(false, `${id} has a reviewed timeline`, why(error));
  }
}

// 4b. The TV app talks to this tunnel. A new tunnel URL needs a TV rebuild (tv/README.md).
try {
  const tvConfig = readFileSync(join(root, 'tv', 'src', 'config.ts'), 'utf8');
  const tvUrl = /SERVER_URL =\s*['"]([^'"]*)['"]/.exec(tvConfig)?.[1] ?? '';
  report(
    tvUrl.replace(/\/+$/, '') === publicUrl,
    'The TV app uses this tunnel URL',
    tvUrl === publicUrl ? '' : `tv/src/config.ts has "${tvUrl}"; rebuild and reinstall the TV app`,
  );
} catch (error) {
  report(false, 'The TV app uses this tunnel URL', why(error));
}

// 5. The built pad, which the server serves at its own URL.
const hasPad = existsSync(join(root, 'pad', 'dist', 'index.html'));
report(hasPad, 'pad/dist exists', hasPad ? '' : 'run npm run build in pad/');

// 6. One real model call. Pip's brain runs on this machine (Ollama) by default; Bedrock (Nova) is an
// optional adapter for when an AWS account is ready (docs/vnext/PLAN.md 0).
console.log(
  env.AI_PROVIDER === 'bedrock'
    ? 'NOTE  AI_PROVIDER=bedrock: Pip uses Nova on AWS'
    : `NOTE  Pip uses the local model (${env.OLLAMA_MODEL ?? 'qwen2.5:3b'}); nothing leaves this machine`,
);
const smoke = await runSmokeAi();
const latency = /latency: (\d+) ms/.exec(smoke.output)?.[1];
const lastLine = smoke.output.trim().split('\n').at(-1) ?? '';
report(smoke.ok, 'smoke:ai answers within 6 s', smoke.ok ? `${latency} ms` : lastLine);
if (env.AI_ENABLED === 'false') {
  report(false, 'AI_ENABLED is true', 'Pip would only say its fixed lines');
}

console.log(
  failed === 0 ? '\nAll checks passed.' : `\n${failed} check${failed === 1 ? '' : 's'} failed.`,
);
process.exit(failed === 0 ? 0 : 1);
