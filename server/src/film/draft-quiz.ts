// Quiz drafts: the prompt, the checks and the answer spread (PROJECT.md section 5.5).
import { z } from 'zod';
import { quizQuestionSchema, type Content, type QuizQuestion } from './content.js';
import { DRAFT_SYSTEM_PROMPT } from './prompts.js';

export const DRAFT_QUESTIONS = 5;
// Right answers for questions 1 to 5 go to B, D, A, C, B: models tend to put them first.
const SPREAD = [1, 3, 0, 2, 1] as const;

const draftSchema = z.object({ quiz: z.array(quizQuestionSchema).length(DRAFT_QUESTIONS) });

/** The system prompt and the user message for one film. */
export function buildDraftPrompt(content: Content): { system: string; user: string } {
  const lines = [
    `<title>${content.title}</title>`,
    `<premise>${content.premise}</premise>`,
    '<notes>',
    ...content.notes.map((note) => `[${note.atSec}] ${note.text}`),
    '</notes>',
    'Write the quiz.',
  ];
  return { system: DRAFT_SYSTEM_PROMPT, user: lines.join('\n') };
}

/** The 5 questions sorted by atSec, or every problem found. */
export function parseQuizDraft(
  raw: string,
  content: Content,
): { ok: true; questions: QuizQuestion[] } | { ok: false; problems: string[] } {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, problems: ['no JSON object in the reply'] };
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch (error) {
    return {
      ok: false,
      problems: [`invalid JSON: ${error instanceof Error ? error.message : 'parse error'}`],
    };
  }
  const parsed = draftSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || 'reply'}: ${issue.message}`,
      ),
    };
  }
  const noteTimes = new Set(content.notes.map((note) => note.atSec));
  const problems = parsed.data.quiz.flatMap((q, i) =>
    noteTimes.has(q.atSec) ? [] : [`quiz.${i}.atSec: ${q.atSec} is not the time of a note`],
  );
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, questions: [...parsed.data.quiz].sort((a, b) => a.atSec - b.atSec) };
}

/** Moves each right choice to B, D, A, C, B, keeping the wrong choices in their order. */
export function spreadAnswers(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((question, i) => {
    const target = SPREAD[i % SPREAD.length] ?? 0;
    const right = question.choices[question.answer] ?? '';
    const wrong = question.choices.filter((_, index) => index !== question.answer);
    const choices = [...wrong.slice(0, target), right, ...wrong.slice(target)];
    return { ...question, choices, answer: target };
  });
}
