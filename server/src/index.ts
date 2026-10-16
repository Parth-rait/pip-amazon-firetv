// Starts the Pip server: HTTP (Express) and Socket.IO on one port.
import 'dotenv/config';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createBedrockModel, createFakeModel } from './core/ai/model.js';
import { createAnswerCache } from './core/context/answer-cache.js';
import { createTimers } from './core/timers.js';
import { loadFilms } from './film/content.js';
import { loadTimeline } from './film/timeline-file.js';
import { log } from './log.js';
import { registerRealtime } from './realtime.js';
import { InMemorySessionStore } from './sessions.js';
import type { ClientToServerEvents, ServerToClientEvents } from './shared/protocol.js';

const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));
const TIMELINES_DIR = fileURLToPath(new URL('../content/timelines', import.meta.url));
const CACHE_MAX_ANSWERS = 200;
const CACHE_TTL_MS = 30 * 60 * 1000;

const config = loadConfig();
const films = loadFilms(CONTENT_DIR);
const timelines = new Map(films.map((film) => [film.id, loadTimeline(TIMELINES_DIR, film)]));
const store = new InMemorySessionStore();
const model = config.AI_ENABLED
  ? createBedrockModel({
      region: config.AWS_REGION,
      profile: config.AWS_PROFILE,
      modelId: config.BEDROCK_MODEL_ID,
    })
  : createFakeModel(() => {
      throw new Error('AI is switched off (AI_ENABLED=false)');
    });

const app = createApp(config, films, { hasSession: (code) => store.get(code) !== undefined });
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

registerRealtime({
  io,
  store,
  films,
  config,
  timers: createTimers(),
  model,
  timelines,
  cache: createAnswerCache(CACHE_MAX_ANSWERS, CACHE_TTL_MS),
  log,
  now: Date.now,
});

httpServer.listen(config.PORT, () => {
  log.info('server.start', {
    port: config.PORT,
    publicUrl: config.PUBLIC_URL,
    films: films.length,
    ai: config.AI_ENABLED,
    timelineReview: config.TIMELINE_REVIEW,
    facts: Object.fromEntries([...timelines].map(([id, t]) => [id, t.facts.length])),
  });
  if (config.TIMELINE_REVIEW === 'candidate') {
    log.warn('timeline.unreviewed', { note: 'TIMELINE_REVIEW=candidate lets unreviewed facts reach people' });
  }
});
