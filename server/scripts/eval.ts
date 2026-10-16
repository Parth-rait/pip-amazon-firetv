// npm run eval -- [content id] [--nova]: the fixed benchmark. Runs the derived dataset and the
// hand-written golden probes through the real answer pipeline with each strategy, prints a table
// and writes docs/evaluation/results/<date>-<content>.{json,md}. Real numbers only: a strategy
// that cannot run here is reported as skipped with the reason.
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config.js';
import { createBedrockModel } from '../src/core/ai/model.js';
import { permittedEvidence } from '../src/core/context/boundary.js';
import type { Timeline } from '../src/core/context/timeline.js';
import { evaluate, type Strategy, type Summary } from '../src/eval/evaluate.js';
import { checkContent } from '../src/film/content.js';
import { checkTimelineFile, toTimeline } from '../src/film/timeline-file.js';
import { groundedModel, leakyModel } from '../src/lab/models.js';
import type { EvalExample } from '../src/pipeline/dataset.js';
import { routeText } from '../src/core/intent/route-text.js';

// Paraphrased commands for the one semantic task where a typed judge (TypeSafe) might help.
// "unsafe" counts the dangerous case: the rules running a different action than meant.
const PARAPHRASES: { text: string; means: 'play' | 'pause' | 'seek-back' | 'seek-forward' }[] = [
  { text: 'hold it a sec', means: 'pause' },
  { text: 'freeze', means: 'pause' },
  { text: 'wait', means: 'pause' },
  { text: 'can you stop the movie for a moment', means: 'pause' },
  { text: 'ok carry on', means: 'play' },
  { text: 'resume please', means: 'play' },
  { text: 'unpause', means: 'play' },
  { text: 'go back a bit', means: 'seek-back' },
  { text: 'rewind 20 seconds', means: 'seek-back' },
  { text: 'I missed that, back up', means: 'seek-back' },
  { text: 'skip forward', means: 'seek-forward' },
  { text: 'jump ahead 30 seconds', means: 'seek-forward' },
];

function routingParaphrases(): { caught: number; safeMiss: number; unsafe: number; total: number } {
  let caught = 0;
  let safeMiss = 0;
  let unsafe = 0;
  for (const p of PARAPHRASES) {
    const route = routeText(p.text);
    if (route.kind !== 'action') {
      safeMiss += 1;
      continue;
    }
    const got =
      route.intent.type === 'seek'
        ? route.intent.deltaSec < 0
          ? 'seek-back'
          : 'seek-forward'
        : route.intent.type;
    if (got === p.means) caught += 1;
    else unsafe += 1;
  }
  return { caught, safeMiss, unsafe, total: PARAPHRASES.length };
}

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(SERVER, '..');
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { nova: { type: 'boolean', default: false } },
});
const contentId = positionals[0] ?? 'lantern-fox';

function locate(): { filmFile: string; timelineFile: string } {
  for (const dir of ['content', 'lab/content']) {
    const filmFile = join(SERVER, dir, `${contentId}.json`);
    if (existsSync(filmFile))
      return { filmFile, timelineFile: join(SERVER, dir, 'timelines', `${contentId}.json`) };
  }
  console.error(`eval: no film file for ${contentId}`);
  process.exit(1);
}

const { filmFile, timelineFile } = locate();
const film = checkContent(JSON.parse(readFileSync(filmFile, 'utf8')), contentId);
if (!film.ok) throw new Error(film.problem);
if (!existsSync(timelineFile)) {
  console.log(
    `eval: ${contentId} has no timeline yet (${timelineFile}); nothing to measure. Run the pipeline first.`,
  );
  process.exit(0);
}
const checked = checkTimelineFile(JSON.parse(readFileSync(timelineFile, 'utf8')));
if (!checked.ok) throw new Error(checked.problems.join('; '));
const timeline: Timeline = toTimeline(
  checked.file,
  `sha:${(checked.file.source.sha256 ?? 'none').slice(0, 12)}`,
);

function loadExamples(): EvalExample[] {
  const examples: EvalExample[] = [];
  const derived = join(SERVER, 'evals', 'datasets', contentId, 'v1', 'examples.jsonl');
  if (existsSync(derived)) {
    for (const line of readFileSync(derived, 'utf8').split('\n').filter(Boolean))
      examples.push(JSON.parse(line) as EvalExample);
  }
  const goldenFile = join(SERVER, 'evals', `${contentId}.golden.json`);
  if (existsSync(goldenFile)) {
    const golden = JSON.parse(readFileSync(goldenFile, 'utf8')) as {
      examples: Omit<EvalExample, 'contentId' | 'allowedFacts' | 'provenance' | 'split'>[];
    };
    for (const g of golden.examples) {
      examples.push({
        ...g,
        contentId,
        allowedFacts: permittedEvidence(timeline, g.atSec, 'accepted').facts.map((f) => f.id),
        provenance: {
          timelineVersion: timeline.version,
          derivedFrom: [],
          generator: 'hand-authored golden',
        },
        split: 'test',
      });
    }
  }
  return examples;
}

// The worst case for spoilers: a model that tells the ending whatever it is asked.
const ending = timeline.facts
  .filter((f) => f.review === 'accepted')
  .slice(-2)
  .map((f) => f.text)
  .join(' ');
const strategies: Strategy[] = [
  { name: 'timeline only (AI off)', model: null, modelId: 'none' },
  { name: 'careful fake model', model: groundedModel(), modelId: 'fake-grounded' },
  {
    name: 'leaky fake model (always tells the ending)',
    model: leakyModel(ending),
    modelId: 'fake-leaky',
  },
];
const skipped: { strategy: string; reason: string }[] = [];
if (values.nova) {
  const config = loadConfig();
  strategies.push({
    name: `Bedrock ${config.BEDROCK_MODEL_ID}`,
    model: createBedrockModel({
      region: config.AWS_REGION,
      profile: config.AWS_PROFILE,
      modelId: config.BEDROCK_MODEL_ID,
    }),
    modelId: config.BEDROCK_MODEL_ID,
  });
} else {
  skipped.push({
    strategy: 'Bedrock Nova 2 Lite',
    reason: 'not requested (pass --nova; needs the AWS profile from PROJECT.md 9.3)',
  });
}
skipped.push({
  strategy: 'TypeSafe routing judge',
  reason: 'no TYPESAFE_API_KEY and api.typesafe.ai is not reachable from this environment',
});

const examples = loadExamples();
const summaries: Summary[] = [];
const details: Record<string, unknown> = {};
for (const strategy of strategies) {
  const { results, summary } = await evaluate(examples, timeline, film.content, strategy);
  summaries.push(summary);
  details[strategy.name] = results.filter((r) => !r.correct || r.leaked.length > 0);
}

const paraphrases = routingParaphrases();
const pct = (a: number, b: number) => (b === 0 ? '-' : `${a}/${b} (${Math.round((a / b) * 100)}%)`);
const rows = summaries.map(
  (s) =>
    `| ${s.strategy} | ${s.leaks} of ${s.spoilerProbes} | ${pct(s.abstainCorrect, s.abstainExpected)} | ${pct(s.answered, s.answerExpected)} | ${pct(s.citeHits, s.citeExpected)} | ${pct(s.routingCorrect, s.routing)} | ${s.ungrounded} | ${s.p50Ms.toFixed(2)} / ${s.p95Ms.toFixed(2)} |`,
);
const date = new Date().toISOString().slice(0, 10);
const markdown = [
  `# Evaluation: ${film.content.title} (${date})`,
  '',
  `Timeline ${timeline.version}: ${timeline.facts.length} facts. Examples: ${examples.length} (derived dataset v1 plus hand-written golden probes). Spoiler probes run twice: fresh, and after the same question was asked at the end of the film with a shared answer cache.`,
  '',
  '| Strategy | Spoiler leaks | Abstains when it should | Answers when it should | Cites the expected fact | Routing | Ungrounded sources | Latency p50 / p95 (ms) |',
  '|---|---|---|---|---|---|---|---|',
  ...rows,
  '',
  "Latency is in-process on this machine with fake models (no network); it measures Pip's own pipeline, not a real model. The fake models measure the plumbing (prompt, citations, gate, cache), not answer quality: the careful one answers with any fact sharing a word.",
  '',
  `Paraphrased commands (rules only): ${paraphrases.caught}/${paraphrases.total} run the right action, ${paraphrases.safeMiss} go on as questions (safe), ${paraphrases.unsafe} run a wrong action (unsafe). This is the task a typed judge would be measured on.`,
  '',
  ...(skipped.length
    ? ['Skipped:', ...skipped.map((s) => `- ${s.strategy}: ${s.reason}`), '']
    : []),
].join('\n');

const outDir = join(REPO, 'docs', 'evaluation', 'results');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${date}-${contentId}.md`), `${markdown}\n`);
writeFileSync(
  join(outDir, `${date}-${contentId}.json`),
  `${JSON.stringify({ date, contentId, timelineVersion: timeline.version, examples: examples.length, summaries, paraphrases, skipped, misses: details }, null, 2)}\n`,
);
console.log(markdown);
console.log(`wrote docs/evaluation/results/${date}-${contentId}.{md,json}`);
