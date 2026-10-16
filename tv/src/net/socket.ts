import {io, Socket} from 'socket.io-client';
import {SERVER_URL} from '../config';
import type {
  ClientToServerEvents,
  HelloResult,
  Playback,
  ServerToClientEvents,
} from '../shared/protocol';

export type TvSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const HELLO_TIMEOUT_MS = 5000;
const HELLO_RETRY_MS = 2000;

// One socket for the whole app. Socket.IO reconnects on its own and falls back to polling.
let socket: TvSocket | null = null;

export function getSocket(): TvSocket {
  if (!socket) {
    socket = io(SERVER_URL, {transports: ['websocket', 'polling']});
  }
  return socket;
}

// Kept in memory only, so a restarted server gives this TV its code back (PROJECT.md 4.5, Join).
let lastHello: {code: string; tvKey: string} | null = null;
// Set by the watch screen while it shows, so a restarted server resumes the film.
let helloPlayback: Playback | null = null;

export function setHelloPlayback(playback: Playback | null): void {
  helloPlayback = playback;
}

/** Sends tv:hello, retrying while the socket stays connected and the server does not answer. */
export function sendHello(
  s: TvSocket,
  onOk: (result: Extract<HelloResult, {ok: true}>) => void,
): void {
  s.timeout(HELLO_TIMEOUT_MS).emit(
    'tv:hello',
    {
      previousCode: lastHello?.code ?? null,
      tvKey: lastHello?.tvKey ?? null,
      playback: helloPlayback,
    },
    (err: Error | null, result?: HelloResult) => {
      if (err || !result) {
        if (s.connected) setTimeout(() => sendHello(s, onOk), HELLO_RETRY_MS);
        return;
      }
      if (!result.ok) {
        console.warn(`[pip] tv:hello refused: ${result.reason}`);
        return;
      }
      lastHello = {code: result.code, tvKey: result.tvKey};
      onOk(result);
    },
  );
}

/** Round trip of one sys:ping in ms, or null if the server did not answer in time. */
export function pingOnce(
  s: TvSocket,
  timeoutMs = 3000,
): Promise<number | null> {
  return new Promise((resolve) => {
    const sentAt = Date.now();
    s.timeout(timeoutMs).emit('sys:ping', {sentAt}, (err: Error | null) => {
      resolve(err ? null : Date.now() - sentAt);
    });
  });
}
