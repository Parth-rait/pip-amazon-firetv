// npm run smoke:quiz: a fake TV and two fake pads play a whole quiz over real sockets; exits 0 on success.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { io, type Socket } from 'socket.io-client';
import { loadConfig } from '../src/config.js';
import { loadFilms } from '../src/film/content.js';
import type {
  ClientToServerEvents,
  HelloResult,
  JoinResult,
  ServerToClientEvents,
  SessionView,
} from '../src/shared/protocol.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const TIMEOUT_MS = 20_000;
const config = loadConfig();
const url = process.argv[2] ?? `http://localhost:${config.PORT}`;
const film = loadFilms(fileURLToPath(new URL('../content', import.meta.url)))[0];
const sockets: Client[] = [];

const deadline = setTimeout(() => fail('timed out after 20 seconds'), TIMEOUT_MS);

function fail(message: string): never {
  console.error(`QUIZ FAILED: ${message}`);
  sockets.forEach((s) => s.close());
  process.exit(1);
}

function connect(): Client {
  const socket: Client = io(url, { forceNew: true, reconnection: false });
  socket.on('connect_error', (error) => fail(`cannot connect to ${url}: ${error.message}`));
  sockets.push(socket);
  return socket;
}

function join(socket: Client, code: string, name: string): Promise<JoinResult> {
  const playerId = randomBytes(16).toString('hex');
  return new Promise((resolve) => socket.emit('pad:join', { code, playerId, name }, resolve));
}

if (!film) fail('no film in content/');
const tv = connect();
const hello = await new Promise<HelloResult>((resolve) =>
  tv.emit('tv:hello', { previousCode: null, tvKey: null, playback: null }, resolve),
);
if (!hello.ok) fail('tv:hello was refused');

const sam = connect();
const mia = connect();
const samJoin = await join(sam, hello.code, 'Sam');
const miaJoin = await join(mia, hello.code, 'Mia');
if (!samJoin.ok || !miaJoin.ok) fail('a pad could not join');
const samId = samJoin.view.players[0]?.id;
const miaId = miaJoin.view.players[1]?.id;

let answeredIndex = -1;
let nextSentFor = -1;
let isStarted = false;

sam.on('session:view', (view: SessionView) => {
  if (view.stage === 'watch' && !isStarted) {
    isStarted = true;
    // The TV reports the end of the film, so every question is unlocked.
    tv.emit('tv:playback', {
      contentId: film.id,
      positionSec: film.durationSec,
      durationSec: film.durationSec,
      paused: true,
      ended: true,
    });
    setTimeout(() => sam.emit('pad:host', { type: 'start-quiz' }), 200);
  }
  const quiz = view.quiz;
  if (view.stage === 'quiz' && quiz?.phase === 'question' && answeredIndex !== quiz.index) {
    answeredIndex = quiz.index;
    if (quiz.correct !== null || quiz.picks !== null)
      fail('the answer was visible before the reveal');
    const right = film.quiz.find((q) => q.question === quiz.question)?.answer ?? 0;
    sam.emit('pad:answer', { index: quiz.index, choice: right });
    mia.emit('pad:answer', { index: quiz.index, choice: (right + 1) % 4 });
  }
  if (view.stage === 'quiz' && quiz?.phase === 'reveal' && nextSentFor !== quiz.index) {
    nextSentFor = quiz.index;
    // A double tap: the second next must be ignored.
    sam.emit('pad:host', { type: 'next', index: quiz.index, phase: 'reveal' });
    sam.emit('pad:host', { type: 'next', index: quiz.index, phase: 'reveal' });
  }
  if (view.stage === 'results' && view.results) {
    const score = (id: string | undefined) => view.players.find((p) => p.id === id)?.score;
    const questions = view.results.questions;
    if (answeredIndex !== questions - 1)
      fail(`a question was skipped (last answered ${answeredIndex})`);
    if (score(samId) !== questions || score(miaId) !== 0) fail('the scores are wrong');
    clearTimeout(deadline);
    console.log(`QUIZ OK questions=${questions} Sam=${score(samId)} Mia=${score(miaId)}`);
    sockets.forEach((s) => s.close());
    process.exit(0);
  }
});

sam.emit('pad:host', { type: 'watch', contentId: film.id });
