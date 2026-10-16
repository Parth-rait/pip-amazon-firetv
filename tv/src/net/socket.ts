import {io, Socket} from 'socket.io-client';
import {SERVER_URL} from '../config';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../shared/protocol';

export type TvSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// One socket for the whole app. Socket.IO reconnects on its own and falls back to polling.
let socket: TvSocket | null = null;

export function getSocket(): TvSocket {
  if (!socket) {
    socket = io(SERVER_URL, {transports: ['websocket', 'polling']});
  }
  return socket;
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
