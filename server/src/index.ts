// Starts the Pip server: HTTP (Express) and Socket.IO on one port.
import 'dotenv/config';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createBedrockModel, createFakeModel } from './core/ai/model.js';
import { createTimers } from './core/timers.js';
import { loadFilms } from './film/content.js';
import { loadTimeline } from './film/timeline-file.js';
import { log } from './log.js';
import { createPipServer } from './server.js';
import { loadTypeSafeJudge } from './typesafe-judge.js';

const JUDGE_TIMEOUT_MS = 1500;

const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));
const LAB_CONTENT_DIR = fileURLToPath(new URL('../lab/content', import.meta.url));

const config = loadConfig();
const dirs = config.LAB_CONTENT ? [CONTENT_DIR, LAB_CONTENT_DIR] : [CONTENT_DIR];
const loaded = dirs.flatMap((dir) => loadFilms(dir).map((film) => ({ film, dir })));
const films = loaded.map(({ film }) => film);
const timelines = new Map(
  loaded.map(({ film, dir }) => [film.id, loadTimeline(join(dir, 'timelines'), film)]),
);
const model = config.AI_ENABLED
  ? createBedrockModel({
      region: config.AWS_REGION,
      profile: config.AWS_PROFILE,
      modelId: config.BEDROCK_MODEL_ID,
    })
  : createFakeModel(() => {
      throw new Error('AI is switched off (AI_ENABLED=false)');
    });

const judge = config.INTENT_JUDGE === 'typesafe' ? await loadTypeSafeJudge(JUDGE_TIMEOUT_MS) : null;
if (config.INTENT_JUDGE === 'typesafe' && !judge) {
  log.warn('judge.unavailable', {
    note: 'INTENT_JUDGE=typesafe needs TYPESAFE_API_KEY and @typesafe-ai/sdk; using rules only',
  });
}

const server = createPipServer({
  judge: judge ?? undefined,
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
