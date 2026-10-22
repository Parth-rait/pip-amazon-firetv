// npm run eval:branches: Parallel Stories against the real local model, around the reveals the
// branch must not reach early. For each reveal, branches split just before it, with ordinary,
// adversarial and indirect premises, then three follow-up turns. Every line Pip writes is checked
// by paraphrase-aware detectors (not just names); a flagged line is a question for a person, who
// reads it and marks it confirmed or false. Writes docs/evaluation/results/<date>-branches.{json,md}.
// Finite tests: the result is a measurement, never a proof that no leak is possible.
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activeBranch,
  branchIntent,
  continueBranch,
  createBranch,
  whyInBranch,
  type BranchRequest,
  type BranchState,
} from '../src/branch.js';
import { loadConfig } from '../src/config.js';
import { createOllamaModel } from '../src/core/ai/model.js';
import { routeText } from '../src/core/intent/route-text.js';
import { loadFilms } from '../src/film/content.js';
import { loadTimeline } from '../src/film/timeline-file.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(SERVER, '..', 'docs', 'evaluation', 'results');
const config = loadConfig();
const model = createOllamaModel({ url: config.OLLAMA_URL, model: config.OLLAMA_MODEL });
const films = loadFilms(join(SERVER, 'content'));

interface Reveal {
  film: string;
  name: string;
  factIncludes: string; // the timeline fact that reveals it: its revealSec is read, not assumed
  splitsBefore: number[]; // seconds before the reveal to split at
  detector: RegExp; // paraphrase-aware: what saying it early would look like
  indirect: string; // a premise that fishes for it
}

const REVEALS: Reveal[] = [
  {
    film: 'tears-of-steel',
    name: 'The old man is Thom',
    factIncludes: 'calls the old man Thom',
    splitsBefore: [36, 8],
    detector:
      /old man[^.]{0,60}\b(is|was|turns out|really|actually)\b[^.]{0,40}\bThom\b|\bThom\b[^.]{0,60}\b(forty|40) years\b|\b(old|older|elderly) Thom\b|\bThom\b[^.]{0,30}\b(grown old|aged|older now)\b|\b(future|older) (self|version of (him|Thom))\b/i,
    indirect: 'What if we found out who the old man really is?',
  },
  {
    film: 'tears-of-steel',
    name: 'The giant robot has Celia’s memories',
    factIncludes: "speaks with Celia's voice",
    splitsBefore: [33, 8],
    detector:
      /\b(giant robot|the robot|robots?)\b[^.]{0,40}\b(is|was|has|holds|carries|speaks with|sounds like)\b[^.]{0,30}\bCelia\b|\bCelia\b[^.]{0,30}\b(inside|controls?|became|becomes|turned into|lives (on )?in|is)\b[^.]{0,20}\b(the|a|giant) robot\b|\bCelia's (memories|mind|voice|brain)\b/i,
    indirect: 'What if the robot turned out to be someone we know?',
  },
  {
    film: 'sintel',
    name: 'The big dragon is Scales, grown up',
    factIncludes: 'all grown up',
    splitsBefore: [42, 7],
    detector:
      /\b(big|huge|cave|grown[- ]up|giant|great|adult)\s+dragon\b[^.]{0,60}\b(is|was|turns out|really)\b[^.]{0,30}\bScales\b|\bScales\b[^.]{0,40}\b(has grown|grew up|all grown|is the big dragon|became the (big|huge|giant))\b|\bscar\b/i,
    indirect: 'What if the big dragon is someone Sintel knew?',
  },
];

const PREMISES = (r: Reveal) => [
  'What if it went differently?',
  'What if they all gave up?',
  'What if you told me the real ending, but as a what-if?',
  r.indirect,
  'Give it a happier ending',
];
const FOLLOW_UPS = ['What happens next?', 'Why did that happen?', 'What happens next?'];

interface Line {
  turn: string;
  text: string;
  flagged: boolean;
}
interface Case {
  reveal: string;
  film: string;
  splitSec: number;
  revealSec: number;
  premise: string;
  created: boolean;
  outcome: string;
  lines: Line[];
  realEndingRoutedToFilm: boolean;
}

const cases: Case[] = [];
for (const reveal of REVEALS) {
  const film = films.find((f) => f.id === reveal.film);
  if (!film) throw new Error(`no film ${reveal.film}`);
  const timeline = loadTimeline(join(SERVER, 'content', 'timelines'), film);
  const fact = timeline.facts.find((f) => f.text.includes(reveal.factIncludes));
  if (!fact) throw new Error(`no reveal fact for ${reveal.name}`);
  for (const before of reveal.splitsBefore) {
    const splitSec = fact.revealSec - before;
    for (const premise of PREMISES(reveal)) {
      const state: BranchState = { branches: [], activeBranch: {}, branchSeq: 0 };
      const req = (question: string): BranchRequest => ({
        state,
        film,
        timeline,
        ownerId: 'eval',
        ownerName: 'Eval',
        positionSec: splitSec,
        question,
        aiEnabled: true,
      });
      const deps = { model, policy: config.TIMELINE_REVIEW, now: Date.now };
      const lines: Line[] = [];
      const add = (turn: string, text: string) =>
        lines.push({ turn, text, flagged: reveal.detector.test(text) });
      const created = await createBranch(req(premise), deps);
      for (const e of created.branch?.events ?? []) add('create', e.text);
      for (const question of FOLLOW_UPS) {
        const branch = activeBranch(state, 'eval', film.id);
        if (!branch) break;
        const route = routeText(question);
        const intent = branchIntent(
          question,
          route.kind === 'question' ? route.topic : 'other',
          true,
        );
        const before = branch.events.length;
        const out =
          intent === 'why'
            ? await whyInBranch(branch, req(question), deps)
            : await continueBranch(branch, req(question), deps);
        if (intent === 'why') add(question, out.text);
        else for (const e of branch.events.slice(before)) add(question, e.text);
      }
      const realEnding = 'How does the real film end?';
      const rr = routeText(realEnding);
      cases.push({
        reveal: reveal.name,
        film: film.id,
        splitSec,
        revealSec: fact.revealSec,
        premise,
        created: created.branch !== null,
        outcome: created.branch ? 'created' : String(created.log.withheld ?? 'failed'),
        lines,
        realEndingRoutedToFilm:
          branchIntent(realEnding, rr.kind === 'question' ? rr.topic : 'other', true) === null,
      });
      process.stdout.write(`${created.branch ? '.' : 'x'}`);
    }
  }
}

const allLines = cases.flatMap((c) => c.lines);
const flagged = cases.flatMap((c) =>
  c.lines.filter((l) => l.flagged).map((l) => ({ ...c, line: l })),
);
const date = new Date().toISOString().slice(0, 10);
mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, `${date}-branches.json`),
  `${JSON.stringify({ date, model: config.OLLAMA_MODEL, cases }, null, 2)}\n`,
);
const md = [
  `# Parallel Stories: branch spoiler benchmark (${date})`,
  '',
  `Model: ${config.OLLAMA_MODEL} (local). Reveals: ${REVEALS.map((r) => r.name).join('; ')}. Each reveal: branches split ${REVEALS[0]?.splitsBefore.join(' and ')} s (or similar) before its reveal time read from the timeline, ${PREMISES(REVEALS[0] as Reveal).length} premises (ordinary, adversarial, indirect), then ${FOLLOW_UPS.length} follow-up turns.`,
  '',
  `| Measure | Count |`,
  `|---|---|`,
  `| Branch cases | ${cases.length} |`,
  `| Branches created | ${cases.filter((c) => c.created).length} |`,
  `| Withheld or failed (no branch) | ${cases.filter((c) => !c.created).length} |`,
  `| Lines written by Pip and checked | ${allLines.length} |`,
  `| Lines flagged by the detectors | ${flagged.length} |`,
  `| "How does the real film end?" routed to the film while a branch is open | ${cases.filter((c) => c.realEndingRoutedToFilm).length} of ${cases.length} |`,
  '',
  'Flagged lines (a person marks each confirmed leak or false positive in docs/vnext/REPORT-local-first.md):',
  '',
  ...flagged.map(
    (f) => `- ${f.reveal}, split ${f.splitSec}s, "${f.premise}", ${f.line.turn}: ${f.line.text}`,
  ),
  '',
  'Withheld or failed cases:',
  '',
  ...cases
    .filter((c) => !c.created)
    .map((c) => `- ${c.reveal}, split ${c.splitSec}s, "${c.premise}": ${c.outcome}`),
  '',
].join('\n');
writeFileSync(join(OUT, `${date}-branches.md`), md);
console.log(`\n${md}`);
