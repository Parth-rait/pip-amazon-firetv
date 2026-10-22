// The one typed socket, and joining: a saved code rejoins after every reconnect (PROJECT.md 4.5).
import { io, type Socket } from 'socket.io-client';
import {
  type AskResult,
  type AskVia,
  type ClientToServerEvents,
  type InputResult,
  type JoinResult,
  type PipInput,
  type ServerToClientEvents,
} from '../shared/protocol';
import { getSavedCode, getSavedName, saveCode, saveName } from '../lib/player-id';
import type { PadAction } from '../state/store';

export type PadSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const ACK_TIMEOUT_MS = 5000;
// After a server restart a pad can be back before the TV has re-created the session, so the first
// retries are quick; then every 10 s, for two minutes in all.
const RETRY_DELAYS_MS = [1000, 2000, 5000];
const RETRY_EVERY_MS = 10_000;
const RETRY_FOR_MS = 2 * 60 * 1000;

/** Same origin: Vite proxies in development, the server serves the built pad in the demo. */
export function createSocket(): PadSocket {
  return io({ autoConnect: false });
}

async function sendJoin(socket: PadSocket, code: string, playerId: string, name: string) {
  try {
    return await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('pad:join', { code, playerId, name });
  } catch {
    return null; // no answer in time; the next reconnect tries again
  }
}

/**
 * Wires the socket to the reducer. Returns join(), for the join screen: a typed code is tried
 * once, never retried by itself. A saved code rejoins on every connect and retries for a while.
 */
export function connectPad(socket: PadSocket, playerId: string, dispatch: (a: PadAction) => void) {
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryUntil = 0;
  let retries = 0;

  const handle = (result: JoinResult | null, code: string, name: string): JoinResult | null => {
    if (result?.ok) {
      saveCode(code);
      saveName(name);
      dispatch({ type: 'joined', view: result.view, at: Date.now() });
    } else if (result) {
      dispatch({ type: 'join-failed', reason: result.reason });
    }
    return result;
  };

  const rejoin = async () => {
    clearTimeout(retryTimer);
    const code = getSavedCode();
    const name = getSavedName();
    if (!code || !name || !socket.connected) return;
    const result = handle(await sendJoin(socket, code, playerId, name), code, name);
    const canRetry =
      result &&
      !result.ok &&
      (result.reason === 'unknown-code' || result.reason === 'rate-limited');
    if (canRetry && Date.now() < retryUntil) {
      dispatch({ type: 'looking-for-tv', isLooking: true });
      retryTimer = setTimeout(() => void rejoin(), RETRY_DELAYS_MS[retries] ?? RETRY_EVERY_MS);
      retries += 1;
      return;
    }
    retries = 0;
    dispatch({ type: 'looking-for-tv', isLooking: false });
    if (result && !result.ok) {
      // Gave up: back to the join screen, with the saved code filled in and the reason shown.
      dispatch({ type: 'leave' });
      dispatch({ type: 'join-failed', reason: result.reason });
    }
  };

  socket.on('connect', () => {
    dispatch({ type: 'connected' });
    retryUntil = Date.now() + RETRY_FOR_MS;
    retries = 0;
    void rejoin();
  });
  socket.on('disconnect', () => dispatch({ type: 'disconnected' }));
  socket.on('session:view', (view) => dispatch({ type: 'view', view, at: Date.now() }));
  socket.on('pip:say', (say) => dispatch({ type: 'say', say }));
  socket.on('pip:missed', (missed) => dispatch({ type: 'missed', missed }));
  socket.on('pip:branch', ({ ownerId, branch }) => dispatch({ type: 'branch', ownerId, branch }));
  socket.connect();

  return {
    async join(code: string, name: string): Promise<JoinResult | null> {
      clearTimeout(retryTimer);
      dispatch({ type: 'looking-for-tv', isLooking: false });
      return handle(await sendJoin(socket, code, playerId, name), code, name);
    },
    /** "Join another TV": forget the saved code and go back to the join screen. */
    leave() {
      clearTimeout(retryTimer);
      saveCode(null);
      dispatch({ type: 'leave' });
    },
    stop() {
      clearTimeout(retryTimer);
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

export type PadConnection = ReturnType<typeof connectPad>;

/** Sends a question to Pip. Null when the server did not answer in time. */
export async function sendAsk(
  socket: PadSocket,
  text: string,
  via: AskVia,
): Promise<AskResult | null> {
  try {
    return await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('pad:ask', { text, via });
  } catch {
    return null;
  }
}

/** Sends one semantic input and returns the server's answer, or null if it did not answer. */
export async function sendInput(socket: PadSocket, input: PipInput): Promise<InputResult | null> {
  if (!socket.connected) return null;
  try {
    return await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('pad:input', input);
  } catch {
    return null;
  }
}

/**
 * Tells the server when this pad is hidden (phone locked, app switched) and shown again, so Pip
 * can catch this viewer up on what they missed. Returns a function that stops listening.
 */
export function reportAway(socket: PadSocket, doc: Document = document): () => void {
  const onChange = () => {
    if (socket.connected) socket.emit('pad:away', { away: doc.visibilityState === 'hidden' });
  };
  doc.addEventListener('visibilitychange', onChange);
  return () => doc.removeEventListener('visibilitychange', onChange);
}
