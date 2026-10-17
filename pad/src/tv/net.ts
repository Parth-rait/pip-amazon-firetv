// The browser TV's socket: the same TV half of the protocol as the Vega app (tv/src/net/socket.ts),
// so the server, the pads and the gesture bridge cannot tell the two TVs apart.
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  HelloResult,
  Playback,
  ServerToClientEvents,
} from '../shared/protocol';

export type TvSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const HELLO_TIMEOUT_MS = 5000;
const HELLO_RETRY_MS = 2000;
// Per tab, so a reload keeps the code and the pads stay paired; a second tab is a second TV.
const HELLO_KEY = 'pip.tv.hello';

/** Same origin: Vite proxies in development, the server serves the built page in the demo. */
export function createTvSocket(): TvSocket {
  return io({ transports: ['websocket', 'polling'] });
}

function readHello(): { code: string; tvKey: string } | null {
  try {
    const raw = sessionStorage.getItem(HELLO_KEY);
    return raw ? (JSON.parse(raw) as { code: string; tvKey: string }) : null;
  } catch {
    return null;
  }
}

function saveHello(hello: { code: string; tvKey: string }): void {
  try {
    sessionStorage.setItem(HELLO_KEY, JSON.stringify(hello));
  } catch {
    // private mode: the code changes on reload, nothing else breaks
  }
}

// Set by the player while it shows, so a restarted server resumes the film.
let helloPlayback: Playback | null = null;

export function setHelloPlayback(playback: Playback | null): void {
  helloPlayback = playback;
}

/** Sends tv:hello, retrying while the socket stays connected and the server does not answer. */
export function sendHello(
  s: TvSocket,
  onOk: (result: Extract<HelloResult, { ok: true }>) => void,
): void {
  const last = readHello();
  s.timeout(HELLO_TIMEOUT_MS).emit(
    'tv:hello',
    { previousCode: last?.code ?? null, tvKey: last?.tvKey ?? null, playback: helloPlayback },
    (err: Error | null, result?: HelloResult) => {
      if (err || !result) {
        if (s.connected) setTimeout(() => sendHello(s, onOk), HELLO_RETRY_MS);
        return;
      }
      if (!result.ok) return;
      saveHello({ code: result.code, tvKey: result.tvKey });
      onOk(result);
    },
  );
}

/**
 * The server builds media, poster and QR links on PUBLIC_URL (the tunnel, for the Fire TV). The
 * browser TV is on the same server, so it fetches by path and the film never goes through the
 * tunnel.
 */
export function local(url: string): string {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}
