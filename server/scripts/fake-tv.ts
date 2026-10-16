// npm run fake:tv: acts like the TV app, for pad development without a Fire TV.
import 'dotenv/config';
import { io, type Socket } from 'socket.io-client';
import { loadConfig } from '../src/config.js';
import type {
  ClientToServerEvents,
  Playback,
  ServerToClientEvents,
  TvCommand,
} from '../src/shared/protocol.js';

const REPORT_EVERY_MS = 5000;
const config = loadConfig();
const url = process.argv[2] ?? `http://localhost:${config.PORT}`;
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url);

let code: string | null = null;
let tvKey: string | null = null;
let playback: Playback | null = null;
let reportedAt = Date.now();

/** Moves the playback position on by the time that passed while playing. */
function advance(): void {
  const now = Date.now();
  if (playback && !playback.paused && !playback.ended) {
    const position = playback.positionSec + (now - reportedAt) / 1000;
    playback.positionSec = Math.min(position, playback.durationSec);
    playback.ended = playback.positionSec >= playback.durationSec;
  }
  reportedAt = now;
}

function report(): void {
  advance();
  if (playback) socket.emit('tv:playback', { ...playback });
}

/** Applies one command and confirms it, like the real TV's player (tv:applied). */
function apply(command: TvCommand): void {
  if (!playback) {
    socket.emit('tv:applied', { id: command.id, ok: false, detail: 'no film' });
    return;
  }
  advance();
  if (command.type === 'play') playback.paused = false;
  if (command.type === 'pause') playback.paused = true;
  if (command.type === 'seek') {
    const target = playback.positionSec + command.deltaSec;
    playback.positionSec = Math.min(Math.max(target, 0), playback.durationSec);
    playback.ended = false;
  }
  // Volume and brightness have nothing to show here; they are confirmed like the rest.
  report();
  socket.emit('tv:applied', { id: command.id, ok: true });
}

socket.on('connect', () => {
  socket.emit('tv:hello', { previousCode: code, tvKey, playback }, (result) => {
    if (!result.ok) return console.error('tv:hello refused:', result.reason);
    code = result.code;
    tvKey = result.tvKey;
    console.log(`code ${result.code}  pad ${result.padUrl}  qr ${result.qrUrl}`);
  });
});

socket.on('session:view', (view) => {
  const names = view.players.map((p) => `${p.name}${p.online ? '' : ' (away)'}`).join(', ');
  console.log(
    `view stage=${view.stage} pip=${view.pip} host=${view.hostId ?? '-'} players=[${names}]`,
  );
  if (view.stage === 'watch' && view.content && playback?.contentId !== view.content.id) {
    // A new film starts playing, like the real TV's watch screen.
    playback = {
      contentId: view.content.id,
      positionSec: 0,
      durationSec: view.content.durationSec,
      paused: false,
      ended: false,
    };
    report();
  }
  if (view.stage !== 'watch') playback = null;
});

socket.on('tv:command', (command) => {
  const detail =
    command.type === 'seek'
      ? ` ${command.deltaSec}`
      : command.type === 'volume' || command.type === 'brightness'
        ? ` ${command.level}`
        : '';
  console.log(`tv:command ${command.type}${detail}`);
  apply(command);
});

socket.on('disconnect', (reason) => console.log(`disconnected: ${reason}`));

setInterval(() => {
  if (playback && !playback.paused && !playback.ended) report();
}, REPORT_EVERY_MS);
