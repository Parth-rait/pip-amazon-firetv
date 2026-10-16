// runAsk(): one guided model call that never throws (PROJECT.md section 5.3).
import { withTimeout, type TextModel } from './model.js';
import { parseReply, type ParsedReply } from './parse-reply.js';

export interface AskSettings {
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  allowClarify: boolean;
}

// ms is how long the model took; replies that did not come from the model leave it out.
export type AskOutcome =
  { reply: ParsedReply; ms?: number } | { reply: null; error: string; ms?: number };

/** Calls the model and parses the reply. error is 'unparsed' or the thrown error's name. */
export async function runAsk(
  model: TextModel,
  prompt: { system: string; user: string },
  question: string,
  settings: AskSettings,
  now: () => number = Date.now,
): Promise<AskOutcome> {
  const startedAt = now();
  try {
    const raw = await withTimeout(
      model.complete({
        system: prompt.system,
        user: prompt.user,
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
        timeoutMs: settings.timeoutMs,
      }),
      settings.timeoutMs,
    );
    const reply = parseReply(raw, question, { allowClarify: settings.allowClarify });
    const ms = now() - startedAt;
    return reply ? { reply, ms } : { reply: null, error: 'unparsed', ms };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    return { reply: null, error: name, ms: now() - startedAt };
  }
}
