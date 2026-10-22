// Film files: the schema and checks from PROJECT.md section 5.6, loading, and what clients may see.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';
import type { ContentView, SceneView } from '../shared/protocol.js';

const CHOICES_PER_QUESTION = 4;

const noteSchema = z.object({
  atSec: z.number().min(0),
  text: z.string().min(1).max(300),
});

export const quizQuestionSchema = z.object({
  atSec: z.number().min(0),
  question: z.string().min(1).max(120),
  choices: z.array(z.string().min(1).max(40)).length(CHOICES_PER_QUESTION),
  answer: z
    .number()
    .int()
    .min(0)
    .max(CHOICES_PER_QUESTION - 1),
  explanation: z.string().min(1).max(200),
});

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase words joined by hyphens');
const mediaUrl = z
  .string()
  .refine((url) => url.startsWith('https://') || url.startsWith('/media/'), {
    message: 'must start with https:// or /media/',
  });

/** One chapter of the story for "Catch me up" (PROJECT.md 2.4). atSec: by then, all of it happened. */
const chapterSchema = z.object({
  atSec: z.number().min(0),
  title: z.string().min(1).max(40),
  summary: z.string().min(1).max(300),
  image: mediaUrl.optional(),
});

/** A character card for "Who's who": it appears at its first fact, and each fact at its time. */
const characterSchema = z.object({
  id: slug,
  name: z.string().min(1).max(40),
  aliases: z.array(z.string().min(2).max(40)).max(6).optional(), // other words for them, for Ask Pip
  image: mediaUrl.optional(),
  facts: z
    .array(z.object({ atSec: z.number().min(0), text: z.string().min(1).max(160) }))
    .min(1)
    .max(8),
});

/** "What happens next?": asked at askAtSec, open until revealAtSec, then revealed. */
const predictionSchema = z.object({
  id: slug,
  askAtSec: z.number().min(0),
  revealAtSec: z.number().min(0),
  question: z.string().min(1).max(100),
  choices: z.array(z.string().min(1).max(40)).min(2).max(3),
  answer: z.number().int().min(0).max(2),
  reveal: z.string().min(1).max(160),
});

function isSortedByTime(items: { atSec: number }[]): boolean {
  return items.every((item, i) => i === 0 || item.atSec >= (items[i - 1]?.atSec ?? 0));
}

export const contentSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase words joined by hyphens'),
    title: z.string().min(1).max(60),
    url: z.string().refine((url) => url.startsWith('https://') || url.startsWith('/media/'), {
      message: 'must start with https:// or /media/',
    }),
    credit: z.string().min(1).max(200),
    durationSec: z.number().positive(),
    poster: mediaUrl.optional(),
    premise: z.string().min(1).max(400),
    tags: z.array(z.string().min(1).max(24)).max(6).default([]), // kind and mood, for Discover
    // A film may have no notes or quiz when Pip answers from its timeline (the lab film).
    notes: z.array(noteSchema).max(40),
    quiz: z.array(quizQuestionSchema).max(8),
    chapters: z.array(chapterSchema).max(20).default([]),
    characters: z.array(characterSchema).max(12).default([]),
    predictions: z.array(predictionSchema).max(6).default([]),
  })
  .superRefine((content, ctx) => {
    const problem = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (!isSortedByTime(content.chapters)) problem(['chapters'], 'must be in order of atSec');
    content.chapters.forEach((chapter, i) => {
      if (chapter.atSec > content.durationSec) {
        problem(['chapters', i, 'atSec'], 'is after the end of the film');
      }
    });
    const characterIds = new Set<string>();
    content.characters.forEach((character, i) => {
      if (characterIds.has(character.id)) problem(['characters', i, 'id'], 'is used twice');
      characterIds.add(character.id);
      if (!isSortedByTime(character.facts)) {
        problem(['characters', i, 'facts'], 'must be in order of atSec');
      }
      if (character.facts.some((fact) => fact.atSec > content.durationSec)) {
        problem(['characters', i, 'facts'], 'has a fact after the end of the film');
      }
    });
    const predictionIds = new Set<string>();
    content.predictions.forEach((prediction, i) => {
      if (predictionIds.has(prediction.id)) problem(['predictions', i, 'id'], 'is used twice');
      predictionIds.add(prediction.id);
      if (prediction.revealAtSec <= prediction.askAtSec) {
        problem(['predictions', i, 'revealAtSec'], 'must be after askAtSec');
      }
      if (prediction.revealAtSec > content.durationSec) {
        problem(['predictions', i, 'revealAtSec'], 'is after the end of the film');
      }
      if (prediction.answer >= prediction.choices.length) {
        problem(['predictions', i, 'answer'], 'is not one of the choices');
      }
    });
    for (const key of ['notes', 'quiz'] as const) {
      const items = content[key];
      if (!isSortedByTime(items)) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'must be in order of atSec' });
      }
      items.forEach((item, i) => {
        if (item.atSec > content.durationSec) {
          ctx.addIssue({
            code: 'custom',
            path: [key, i, 'atSec'],
            message: 'is after the end of the film',
          });
        }
      });
    }
  });

export type Content = z.infer<typeof contentSchema>;
export type Note = Content['notes'][number];
export type QuizQuestion = Content['quiz'][number];
export type Chapter = Content['chapters'][number];
export type Character = Content['characters'][number];
export type Prediction = Content['predictions'][number];

/** Checks one parsed film file; returns the film or the first problem as text. */
export function checkContent(
  data: unknown,
  fileId: string,
): { ok: true; content: Content } | { ok: false; problem: string } {
  const result = contentSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return { ok: false, problem: `${where}${issue?.message ?? 'invalid'}` };
  }
  if (result.data.id !== fileId) {
    return { ok: false, problem: `id "${result.data.id}" does not match the file name` };
  }
  return { ok: true, content: result.data };
}

/** Reads and checks every content/*.json; exits with the file name and first problem if one fails. */
export function loadFilms(dir: string): Content[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  return files.map((name) => {
    const file = join(dir, name);
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      return exitWith(file, error instanceof Error ? error.message : String(error));
    }
    const checked = checkContent(data, basename(name, '.json'));
    return checked.ok ? checked.content : exitWith(file, checked.problem);
  });
}

function exitWith(file: string, problem: string): never {
  console.error(`Invalid film file ${file}: ${problem}`);
  process.exit(1);
}

/** What clients see of a film: a full URL, never the notes or the quiz. */
export function toContentView(content: Content, publicUrl: string): ContentView {
  return {
    id: content.id,
    title: content.title,
    url: new URL(content.url, publicUrl).toString(),
    credit: content.credit,
    durationSec: content.durationSec,
    poster: content.poster ? new URL(content.poster, publicUrl).toString() : null,
    synopsis: content.premise,
    tags: content.tags,
  };
}

/**
 * The chapters fully watched by `untilSec`, each with where it begins, for the TV's Scenes page.
 * Spoiler-safe by construction: nothing after `untilSec` is returned.
 */
export function watchedScenes(content: Content, untilSec: number, publicUrl: string): SceneView[] {
  return content.chapters
    .map((chapter, i) => ({
      startSec: i === 0 ? 0 : (content.chapters[i - 1]?.atSec ?? 0),
      atSec: chapter.atSec,
      title: chapter.title,
      summary: chapter.summary,
      image: chapter.image ? new URL(chapter.image, publicUrl).toString() : null,
    }))
    .filter((scene) => scene.atSec <= untilSec);
}

/** The quiz questions the family has already seen enough to answer. */
export function unlockedQuestions(content: Content, positionSec: number): QuizQuestion[] {
  return content.quiz.filter((question) => question.atSec <= positionSec);
}
