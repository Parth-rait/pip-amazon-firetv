// The one typed socket, and joining: a saved code rejoins after every reconnect (PROJECT.md 4.5).
import { io, type Socket } from 'socket.io-client';
import {
  type AskResult,
  type AskVia,
  type ClientToServerEvents,
  type JoinResult,
  type ServerToClientEvents,
} from '../shared/protocol';
import {
  getSavedAvatar,
  getSavedCode,
  getSavedName,
  saveAvatar,
  saveCode,
  saveName,
} from '../lib/player-id';
import type { PadAction } from '../state/store';

export type PadSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const ACK_TIMEOUT_MS = 5000;
const RETRY_EVERY_MS = 10_000;
const RETRY_FOR_MS = 2 * 60 * 1000;

/** Same origin: Vite proxies in development, the server serves the built pad in the demo. */
export function createSocket(): PadSocket {
  return io({ autoConnect: false });
}

async function sendJoin(socket: PadSocket, code: string, playerId: string, name: string) {
  const avatar = getSavedAvatar() ?? undefined;
  try {
    return await socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck('pad:join', { code, playerId, name, avatar });
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
      retryTimer = setTimeout(() => void rejoin(), RETRY_EVERY_MS);
      return;
    }
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
    void rejoin();
  });
  socket.on('disconnect', () => dispatch({ type: 'disconnected' }));
  socket.on('session:view', (view) => dispatch({ type: 'view', view, at: Date.now() }));
  socket.on('pip:say', (say) => dispatch({ type: 'say', say }));
  socket.connect();

  return {
    async join(code: string, name: string, avatar?: number): Promise<JoinResult | null> {
      clearTimeout(retryTimer);
      if (avatar !== undefined) saveAvatar(avatar);
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
