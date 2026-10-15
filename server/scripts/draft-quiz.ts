// npm run draft:quiz -- <film id>: Nova drafts 5 questions for Parth to check (PROJECT.md 5.5).
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { createBedrockModel } from '../src/core/ai/model.js';
import { formatTime } from '../src/film/ask-prompt.js';
import { loadFilms } from '../src/film/content.js';
import { buildDraftPrompt, parseQuizDraft, spreadAnswers } from '../src/film/draft-quiz.js';
import { DRAFT_SETTINGS } from '../src/film/prompts.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const filmId = process.argv[2];
const contentDir = fileURLToPath(new URL('../content', import.meta.url));
const draftsDir = fileURLToPath(new URL('../content/drafts', import.meta.url));

if (!filmId) {
  console.error('Usage: npm run draft:quiz -- <film id>');
  process.exit(1);
}
const film = loadFilms(contentDir).find((f) => f.id === filmId);
if (!film) {
  console.error(`No film "${filmId}" in content/.`);
  process.exit(1);
}

const config = loadConfig();
const model = createBedrockModel({
  region: config.AWS_REGION,
  profile: config.AWS_PROFILE,
  modelId: config.BEDROCK_MODEL_ID,
});

let raw: string;
try {
  raw = await model.complete({ ...buildDraftPrompt(film), ...DRAFT_SETTINGS });
} catch (error) {
  const name = error instanceof Error ? error.name : 'Error';
  console.error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const parsed = parseQuizDraft(raw, film);
if (!parsed.ok) {
  console.error(
    `The draft failed the checks:\n- ${parsed.problems.join('\n- ')}\n\nRaw reply:\n${raw}`,
  );
  console.error('\nRun it again, or write the questions by hand.');
  process.exit(1);
}

const questions = spreadAnswers(parsed.questions);
mkdirSync(draftsDir, { recursive: true });
const file = `${draftsDir}/${film.id}.quiz.json`;
writeFileSync(file, `${JSON.stringify({ quiz: questions }, null, 2)}\n`);

console.log(
  `Draft written to ${file}\nCheck every question (PROJECT.md 5.5) before copying it into the film file.\n`,
);
questions.forEach((q, i) => {
  const note = film.notes.find((n) => n.atSec === q.atSec)?.text ?? '';
  console.log(`${i + 1}. Unlocks at ${formatTime(q.atSec)}. Note: ${note}`);
  console.log(`   ${q.question}`);
  q.choices.forEach((choice, c) => {
    console.log(`   ${c === q.answer ? '*' : ' '} ${LETTERS[c]}  ${choice}`);
  });
  console.log(`   Why: ${q.explanation}\n`);
});
