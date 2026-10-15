// scripts/preflight.mjs
// Checks the demo setup before a rehearsal or a recording (PROJECT.md Step 11) and prints one
// PASS or FAIL line per check. Start the tunnel and the server first. Exits 1 if anything fails.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILM_ID = 'big-buck-bunny';
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

// 3. The film is listed with a full URL, and its first 100 bytes come back as a 206.
if (isServerUp) {
  try {
    const films = await (await get(`${publicUrl}/api/films`)).json();
    const film = Array.isArray(films) ? films.find((f) => f.id === FILM_ID) : undefined;
    const hasFullUrl = typeof film?.url === 'string' && film.url.startsWith(`${publicUrl}/`);
    report(hasFullUrl, '/api/films lists the film with a full URL', film?.url ?? `no "${FILM_ID}"`);
    if (hasFullUrl) {
      const res = await get(film.url, { Range: 'bytes=0-99' });
      const type = res.headers.get('content-type') ?? '';
      await res.arrayBuffer();
      report(
        res.status === 206 && type.startsWith('video/mp4'),
        'The film answers a Range request',
        `${res.status} ${type}`,
      );
    }
  } catch (error) {
    report(false, '/api/films lists the film with a full URL', why(error));
  }
} else {
  report(false, '/api/films and the film', 'skipped: the server did not answer');
}

// 4. The film file has the checked quiz.
try {
  const content = JSON.parse(
    readFileSync(join(root, 'server', 'content', `${FILM_ID}.json`), 'utf8'),
  );
  const count = Array.isArray(content.quiz) ? content.quiz.length : 0;
  report(
    count === QUIZ_QUESTIONS,
    `The film file has ${QUIZ_QUESTIONS} quiz questions`,
    `found ${count}`,
  );
} catch (error) {
  report(false, `The film file has ${QUIZ_QUESTIONS} quiz questions`, why(error));
}

// 5. The built pad, which the server serves at its own URL.
const hasPad = existsSync(join(root, 'pad', 'dist', 'index.html'));
report(hasPad, 'pad/dist exists', hasPad ? '' : 'run npm run build in pad/');

// 6. One real Nova call.
const smoke = await runSmokeAi();
const latency = /latency: (\d+) ms/.exec(smoke.output)?.[1];
const lastLine = smoke.output.trim().split('\n').at(-1) ?? '';
report(smoke.ok, 'smoke:ai answers within 6 s', smoke.ok ? `${latency} ms` : lastLine);

console.log(
  failed === 0 ? '\nAll checks passed.' : `\n${failed} check${failed === 1 ? '' : 's'} failed.`,
);
process.exit(failed === 0 ? 0 : 1);
