// Starts the Pip server: HTTP (Express) and Socket.IO on one port.
import 'dotenv/config';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createAnswerMemory } from './core/ai/answer-memory.js';
import { createFileJournal } from './core/journal.js';
import { createBedrockModel, createFakeModel, createOllamaModel } from './core/ai/model.js';
import { createTimers } from './core/timers.js';
import { loadFilms } from './film/content.js';
import { loadTimeline } from './film/timeline-file.js';
import { loadTypeSafeJudge } from './typesafe-judge.js';
import { log } from './log.js';
import { createPipServer } from './server.js';

const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));
const LAB_CONTENT_DIR = fileURLToPath(new URL('../lab/content', import.meta.url));
const MEMORY_FILE = fileURLToPath(new URL('../data/answer-memory.json', import.meta.url));
const JOURNAL_DIR = fileURLToPath(new URL('../data/events', import.meta.url));
const WARM_UP_MS = 120_000;
const JUDGE_TIMEOUT_MS = 1500;

const config = loadConfig();
// Each film may have content/timelines/<id>.json: reviewed facts with evidence (vNext). Films
// without one answer from their notes. The lab film comes only with LAB_CONTENT=true.
const dirs = config.LAB_CONTENT ? [CONTENT_DIR, LAB_CONTENT_DIR] : [CONTENT_DIR];
const loaded = dirs.flatMap((dir) => loadFilms(dir).map((film) => ({ film, dir })));
const films = loaded.map(({ film }) => film);
const timelines = new Map(
  loaded.map(({ film, dir }) => [film.id, loadTimeline(join(dir, 'timelines'), film)]),
);
const model = !config.AI_ENABLED
  ? createFakeModel(() => {
      throw new Error('AI is switched off (AI_ENABLED=false)');
    })
  : config.AI_PROVIDER === 'ollama'
    ? createOllamaModel({ url: config.OLLAMA_URL, model: config.OLLAMA_MODEL })
    : createBedrockModel({
        region: config.AWS_REGION,
        profile: config.AWS_PROFILE,
        modelId: config.BEDROCK_MODEL_ID,
      });
const memory = config.ANSWER_MEMORY
  ? createAnswerMemory({
      file: MEMORY_FILE,
      now: Date.now,
      onError: (error) =>
        log.warn('memory.error', { error: error instanceof Error ? error.name : 'Error' }),
    })
  : undefined;

const journal = config.JOURNAL
  ? createFileJournal({
      dir: JOURNAL_DIR,
      now: Date.now,
      onError: (error) =>
        log.warn('journal.error', { error: error instanceof Error ? error.name : 'Error' }),
    })
  : undefined;

// A local model takes many seconds to load the first time; load it before anyone asks.
if (config.AI_ENABLED && config.AI_PROVIDER === 'ollama') {
  const startedAt = Date.now();
  model
    .complete({
      system: 'Reply with OK.',
      user: 'OK',
      maxTokens: 2,
      temperature: 0,
      timeoutMs: WARM_UP_MS,
    })
    .then(() => log.info('model.warm', { ms: Date.now() - startedAt }))
    .catch((error: unknown) =>
      log.warn('model.warm.failed', { error: error instanceof Error ? error.name : 'Error' }),
    );
}

const judge = config.INTENT_JUDGE === 'typesafe' ? await loadTypeSafeJudge(JUDGE_TIMEOUT_MS) : null;
if (config.INTENT_JUDGE === 'typesafe' && !judge) {
  log.warn('judge.unavailable', {
    note: 'INTENT_JUDGE=typesafe needs TYPESAFE_API_KEY and @typesafe-ai/sdk; using rules only',
  });
}

const { httpServer } = createPipServer({
  config,
  films,
  timelines,
  model,
  timers: createTimers(),
  memory,
  journal,
  judge: judge ?? undefined,
  log,
  now: Date.now,
});

httpServer.listen(config.PORT, () => {
  log.info('server.start', {
    port: config.PORT,
    publicUrl: config.PUBLIC_URL,
    films: films.length,
    ai: config.AI_ENABLED,
    provider: config.AI_PROVIDER,
    memory: config.ANSWER_MEMORY,
    timelineReview: config.TIMELINE_REVIEW,
    facts: Object.fromEntries([...timelines].map(([id, t]) => [id, t.facts.length])),
  });
});
