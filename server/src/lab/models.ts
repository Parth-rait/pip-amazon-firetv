// Fake text models for the Virtual Pip Lab and the evaluation: well-behaved, leaky, broken, slow.
// Each answers from the prompt it is given, so they exercise the real prompt and answer gate.
import { contentWords } from '../core/context/text.js';
import { createFakeModel, type CompleteInput, type TextModel } from '../core/ai/model.js';

interface PromptFact {
  id: string;
  text: string;
}

/** The facts and question inside a buildAskPrompt() user message. */
export function readPrompt(user: string): { facts: PromptFact[]; question: string } {
  const facts: PromptFact[] = [];
  for (const match of user.matchAll(/^\[([A-Za-z0-9_-]+) \d+:\d{2}\] (.+)$/gm)) {
    facts.push({ id: match[1] ?? '', text: match[2] ?? '' });
  }
  const question = /^Question: (.*)$/m.exec(user)?.[1] ?? '';
  return { facts, question };
}

/** Capitalised words in the facts stand for names; a careful model needs more than a name. */
function bestFact(facts: PromptFact[], question: string): PromptFact | null {
  const names = new Set(
    facts.flatMap((f) => (f.text.match(/\b[A-Z][a-z]+\b/g) ?? []).map((w) => w.toLowerCase())),
  );
  const asked = new Set(contentWords(question));
  let best: { fact: PromptFact; score: number } | null = null;
  for (const fact of facts) {
    const shared = contentWords(fact.text).filter((w) => asked.has(w));
    const predicate = shared.filter((w) => !names.has(w)).length;
    if (predicate > 0 && (!best || shared.length > best.score))
      best = { fact, score: shared.length };
  }
  return best?.fact ?? null;
}

/**
 * A careful model: answers with the best-matching fact it was given and cites it, or says it is
 * not sure. Stands in for a well-prompted real model in deterministic tests.
 */
export function groundedModel(): TextModel {
  return createFakeModel((input: CompleteInput) => {
    const { facts, question } = readPrompt(input.user);
    const fact = bestFact(facts, question);
    if (!fact) return 'ANSWER: I am not sure yet.\nSOURCES: none';
    return `ANSWER: ${fact.text}\nNEXT: What happens next? | Who else is there?\nSOURCES: ${fact.id}`;
  });
}

/**
 * A model that "knows the whole story" (as a real model may know a famous film) and says it,
 * citing a permitted fact to look grounded. The answer gate must stop it.
 */
export function leakyModel(spoiler: string): TextModel {
  return createFakeModel((input: CompleteInput) => {
    const first = readPrompt(input.user).facts[0]?.id ?? 'none';
    return `ANSWER: ${spoiler}\nNEXT: What happens at the end?\nSOURCES: ${first}`;
  });
}

/** Replies that break the format in the ways real models do. */
export function malformedModel(): TextModel {
  return createFakeModel(() => 'NEXT: a | b\n```json\n{"oops": true}\n```');
}

/** Throws like a throttled or failing service. */
export function failingModel(name = 'ThrottlingException'): TextModel {
  return createFakeModel(() => {
    const error = new Error('fake failure');
    error.name = name;
    throw error;
  });
}

/** A model whose replies the test releases by hand, to control timing exactly. */
export function heldModel(
  reply: (input: CompleteInput) => string,
): TextModel & { release(): void; pending(): number } {
  const waiting: (() => void)[] = [];
  const model = createFakeModel(
    (input) =>
      new Promise<string>((resolve) => {
        waiting.push(() => resolve(reply(input)));
      }),
  );
  return {
    ...model,
    release: () => waiting.shift()?.(),
    pending: () => waiting.length,
  };
}
