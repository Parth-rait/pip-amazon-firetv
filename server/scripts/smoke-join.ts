// npm run smoke:join: a fake TV and two fake pads join over real sockets; exits 0 on success.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { loadConfig } from '../src/config.js';
import type {
  ClientToServerEvents,
  JoinResult,
  ServerToClientEvents,
  SessionView,
  TvCommand,
} from '../src/shared/protocol.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const TIMEOUT_MS = 5000;
const SETTLE_MS = 300;
const config = loadConfig();
const url = process.argv[2] ?? `http://localhost:${config.PORT}`;
const sockets: Client[] = [];

const deadline = setTimeout(() => fail('timed out after 5 seconds'), TIMEOUT_MS);

function fail(message: string): never {
  console.error(`JOIN FAILED: ${message}`);
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const tv = connect();
const commands: TvCommand[] = [];
let tvView: SessionView | null = null;
tv.on('tv:command', (command) => commands.push(command));
tv.on('session:view', (view) => (tvView = view));
// A function, so TypeScript does not narrow the value the listener keeps changing.
const latest = (): SessionView | null => tvView;

const hello = await new Promise<Parameters<Parameters<ClientToServerEvents['tv:hello']>[1]>[0]>(
  (resolve) => tv.emit('tv:hello', { previousCode: null, tvKey: null, playback: null }, resolve),
);
if (!hello.ok) fail('tv:hello was refused');
const code = hello.code;

const first = connect();
const second = connect();
const sam = await join(first, code, 'Sam');
const sam2 = await join(second, code, 'sam');
if (!sam.ok || !sam2.ok) fail('a pad could not join');

const filmId = sam2.view.content?.id ?? 'sintel';
second.emit('pad:host', { type: 'watch', contentId: filmId });
await wait(SETTLE_MS);
if (latest()?.stage !== 'lobby') fail('a host command from the second pad was not ignored');

first.emit('pad:host', { type: 'watch', contentId: filmId });
await wait(SETTLE_MS);
const paused = await first.emitWithAck('pad:input', {
  id: `smoke-${Date.now()}`,
  source: 'simulator',
  at: Date.now(),
  event: { type: 'media.pause' },
});
if (!paused.ok) fail(`the host's pause input was refused: ${paused.reason}`);
await wait(SETTLE_MS);
if (latest()?.stage !== 'watch') fail('the host could not start the film');
if (!commands.some((c) => c.type === 'pause')) fail('the pause command did not reach the TV');

// A join without an ack must be dropped, not crash the server.
(second as unknown as Socket).emit('pad:join', { code, playerId: 'f'.repeat(32), name: 'NoAck' });
await wait(SETTLE_MS);
const health = await fetch(`${url}/health`).catch(() => null);
if (!health?.ok) fail('the server stopped answering /health after a join without an ack');

const view = latest();
const names = view?.players.map((p) => p.name) ?? [];
const host = view?.players.find((p) => p.id === view.hostId)?.name;
if (names.join(',') !== 'Sam,sam 2' || host !== 'Sam')
  fail(`unexpected players ${names.join(',')}`);

clearTimeout(deadline);
console.log(`JOIN OK code=${code} players=${names.join(',')} host=${host}`);
sockets.forEach((s) => s.close());
process.exit(0);
