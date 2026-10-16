// Film files: the schema and checks from PROJECT.md section 5.6, loading, and what clients may see.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';
import type { ContentView } from '../shared/protocol.js';

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
    poster: z
      .string()
      .refine((url) => url.startsWith('https://') || url.startsWith('/media/'), {
        message: 'must start with https:// or /media/',
      })
      .optional(),
    premise: z.string().min(1).max(400),
    notes: z.array(noteSchema).min(1).max(40),
    quiz: z.array(quizQuestionSchema).min(1).max(8),
  })
  .superRefine((content, ctx) => {
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
  };
}

/** The quiz questions the family has already seen enough to answer. */
export function unlockedQuestions(content: Content, positionSec: number): QuizQuestion[] {
  return content.quiz.filter((question) => question.atSec <= positionSec);
}
