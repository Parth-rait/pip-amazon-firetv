// npm run timeline:notes -- <film id> [--reviewer "name"] [--lines-from path/to/timeline.json]
// Writes content/timelines/<film id>.json from the film's notes and character cards
// (src/pipeline/from-notes.ts), so the film answers through the grounded path. --lines-from copies
// speech-recognition lines from a pipeline timeline as extra evidence. The file is checked before
// it is written; the server refuses a timeline that fails its checks.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadFilms } from '../src/film/content.js';
import { checkTimelineFile } from '../src/film/timeline-file.js';
import { timelineFromNotes } from '../src/pipeline/from-notes.js';
import { sha256File } from '../src/pipeline/media-tools.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..');
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    reviewer: { type: 'string', default: 'claude-code (frame check)' },
    'lines-from': { type: 'string' },
  },
});
const filmId = positionals[0];
const film = loadFilms(join(SERVER, 'content')).find((f) => f.id === filmId);
if (!film) {
  console.error(`timeline:notes: no film "${filmId ?? ''}" in content/`);
  process.exit(1);
}

let lines;
if (values['lines-from']) {
  const source = checkTimelineFile(JSON.parse(readFileSync(values['lines-from'], 'utf8')));
  if (!source.ok) {
    console.error(`timeline:notes: ${values['lines-from']} is not a valid timeline`);
    process.exit(1);
  }
  lines = source.file.lines;
}

const media = join(SERVER, 'media', `${film.id}.mp4`);
const license = film.credit.match(/CC[\w\s.-]+\d\.\d/)?.[0] ?? 'see credit';
const file = timelineFromNotes({
  film,
  reviewer: values.reviewer,
  reviewedAt: new Date().toISOString().slice(0, 10),
  sha256: existsSync(media) ? await sha256File(media) : null,
  license,
  ...(lines ? { lines } : {}),
});
const checked = checkTimelineFile(file);
if (!checked.ok) {
  console.error(`timeline:notes: the result fails its checks:\n  ${checked.problems.join('\n  ')}`);
  process.exit(1);
}
const out = join(SERVER, 'content', 'timelines', `${film.id}.json`);
writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
console.log(
  `wrote ${out}: ${file.facts.length} facts, ${file.entities.length} entities, ` +
    `${file.lines.length} lines, ${file.scenes.length} scenes`,
);
