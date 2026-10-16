// Starts the Pip server: HTTP (Express) and Socket.IO on one port.
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createBedrockModel, createFakeModel } from './core/ai/model.js';
import { createTimers } from './core/timers.js';
import { loadFilms } from './film/content.js';
import { loadTimeline } from './film/timeline-file.js';
import { log } from './log.js';
import { createPipServer } from './server.js';

const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));
const TIMELINES_DIR = fileURLToPath(new URL('../content/timelines', import.meta.url));

const config = loadConfig();
const films = loadFilms(CONTENT_DIR);
const timelines = new Map(films.map((film) => [film.id, loadTimeline(TIMELINES_DIR, film)]));
const model = config.AI_ENABLED
  ? createBedrockModel({
      region: config.AWS_REGION,
      profile: config.AWS_PROFILE,
      modelId: config.BEDROCK_MODEL_ID,
    })
  : createFakeModel(() => {
      throw new Error('AI is switched off (AI_ENABLED=false)');
    });

const server = createPipServer({
  config,
  films,
  timelines,
  model,
  timers: createTimers(),
  log,
  now: Date.now,
});

server.httpServer.listen(config.PORT, () => {
  log.info('server.start', {
    port: config.PORT,
    publicUrl: config.PUBLIC_URL,
    films: films.length,
    ai: config.AI_ENABLED,
    timelineReview: config.TIMELINE_REVIEW,
    facts: Object.fromEntries([...timelines].map(([id, t]) => [id, t.facts.length])),
  });
  if (config.TIMELINE_REVIEW === 'candidate') {
    log.warn('timeline.unreviewed', {
      note: 'TIMELINE_REVIEW=candidate lets unreviewed facts reach people',
    });
  }
});
