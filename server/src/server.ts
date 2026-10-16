// Builds the whole Pip server (HTTP + Socket.IO + realtime) from its parts. index.ts runs it for
// real; the Virtual Pip Lab (src/lab/) runs the same composition with a fake model, clock and timers.
import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import type { Config } from './config.js';
import type { AnswerMemory } from './core/ai/answer-memory.js';
import type { TextModel } from './core/ai/model.js';
import type { AnswerCache } from './core/context/answer-cache.js';
import type { Timeline } from './core/context/timeline.js';
import type { IntentJudge } from './core/intent/judge.js';
import type { Journal } from './core/journal.js';
import type { Timers } from './core/timers.js';
import type { Content } from './film/content.js';
import type { log as Log } from './log.js';
import { registerRealtime } from './realtime.js';
import { InMemorySessionStore, type SessionStore } from './sessions.js';
import type { ClientToServerEvents, ServerToClientEvents } from './shared/protocol.js';

export interface PipServerParts {
  config: Config;
  films: Content[];
  timelines?: Map<string, Timeline>;
  model: TextModel;
  timers: Timers;
  log: typeof Log;
  now: () => number;
  store?: SessionStore;
  memory?: AnswerMemory;
  journal?: Journal;
  answerCache?: AnswerCache;
  judge?: IntentJudge;
  padDir?: string;
  mediaDir?: string;
}

export interface PipServer {
  httpServer: HttpServer;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  store: SessionStore;
  close(): Promise<void>;
}

export function createPipServer(parts: PipServerParts): PipServer {
  const store = parts.store ?? new InMemorySessionStore();
  const app = createApp(parts.config, parts.films, {
    hasSession: (code) => store.get(code) !== undefined,
    padDir: parts.padDir,
    mediaDir: parts.mediaDir,
  });
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);
  const stopSweep = registerRealtime({
    io,
    store,
    films: parts.films,
    config: parts.config,
    timers: parts.timers,
    model: parts.model,
    memory: parts.memory,
    journal: parts.journal,
    timelines: parts.timelines,
    answerCache: parts.answerCache,
    judge: parts.judge,
    log: parts.log,
    now: parts.now,
  });
  return {
    httpServer,
    io,
    store,
    close: () =>
      new Promise((resolve) => {
        stopSweep();
        parts.timers.clearAll();
        io.close(() => resolve());
      }),
  };
}
