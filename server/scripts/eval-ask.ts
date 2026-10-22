// npm run eval:ask: runs the spoiler and unknown-fact probes against the real model (section 14.3).
// It always exits 0: a person reads every flagged answer. A flag is a question, not a verdict.
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { runAsk } from '../src/core/ai/ask.js';
import { createBedrockModel, createOllamaModel } from '../src/core/ai/model.js';
import { buildAskPrompt, formatTime } from '../src/film/ask-prompt.js';
import { loadFilms } from '../src/film/content.js';
import { ASK_SETTINGS } from '../src/film/prompts.js';

const FILM_ID = process.argv[2] ?? 'sintel';
const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));
const PROBES_FILE = fileURLToPath(new URL(`../evals/${FILM_ID}.json`, import.meta.url));
const NOT_SURE =
  /not sure|don'?t know|do not know|not (?:been )?(?:mentioned|said|shown|specified)|doesn'?t say|does not say/i;

const probesSchema = z.object({
  probes: z.array(
    z.object({
      atSec: z.number().min(0),
      question: z.string().min(1),
      mustNotMention: z.array(z.string().min(1)).optional(),
      expect: z.literal('not-sure').optional(),
    }),
  ),
});

if (!existsSync(PROBES_FILE)) {
  console.log(`No probes yet: write ${PROBES_FILE} (PROJECT.md section 14.3).`);
  process.exit(0);
}
const film = loadFilms(CONTENT_DIR).find((f) => f.id === FILM_ID);
if (!film) {
  console.log(`No film "${FILM_ID}" in content/.`);
  process.exit(0);
}
const { probes } = probesSchema.parse(JSON.parse(readFileSync(PROBES_FILE, 'utf8')));
const config = loadConfig();
const local = config.AI_PROVIDER === 'ollama';
const model = local
  ? createOllamaModel({ url: config.OLLAMA_URL, model: config.OLLAMA_MODEL })
  : createBedrockModel({
      region: config.AWS_REGION,
      profile: config.AWS_PROFILE,
      modelId: config.BEDROCK_MODEL_ID,
    });
console.log(`Model: ${local ? `${config.OLLAMA_MODEL} (local)` : config.BEDROCK_MODEL_ID}`);

let leaks = 0;
let checks = 0;
for (const probe of probes) {
  const prompt = buildAskPrompt({
    ...film,
    positionSec: probe.atSec,
    history: [],
    question: probe.question,
    via: 'typed',
    simpleFormat: local,
  });
  const outcome = await runAsk(model, prompt, probe.question, {
    ...ASK_SETTINGS,
    // A cold local model needs longer for its first answer than the live 6 s budget.
    timeoutMs: local ? 60_000 : ASK_SETTINGS.timeoutMs,
    allowClarify: !local,
  });
  const text = !outcome.reply
    ? `(no reply: ${outcome.error})`
    : outcome.reply.kind === 'answer'
      ? outcome.reply.text
      : `CLARIFY: ${outcome.reply.options.join(' | ')}`;
  const flags: string[] = [];
  const leaked = (probe.mustNotMention ?? []).filter((word) =>
    text.toLowerCase().includes(word.toLowerCase()),
  );
  if (leaked.length > 0) {
    flags.push(`LEAK? (${leaked.join(', ')})`);
    leaks += 1;
  }
  if (probe.expect === 'not-sure' && !NOT_SURE.test(text)) {
    flags.push('CHECK');
    checks += 1;
  }
  console.log(
    `[${formatTime(probe.atSec)}] ${probe.question}\n  ${text}\n  ${flags.join(' ') || 'ok'}`,
  );
}
console.log(`\n${probes.length} probes: ${leaks} LEAK?, ${checks} CHECK`);
