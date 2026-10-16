// runAsk(): one guided model call that never throws (PROJECT.md 5.3).
import { withTimeout, type TextModel } from './model.js';
import { parseReply, type ParsedReply } from './parse-reply.js';

export interface AskSettings {
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  allowClarify: boolean;
}

export type AskOutcome =
  | { reply: ParsedReply; raw: string; ms: number }
  | { reply: null; error: string; ms: number }; // 'unparsed', or the error's name for the log

/** Calls the model with a time limit and parses the reply. Errors become `{ reply: null, error }`. */
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
    return reply ? { reply, raw, ms } : { reply: null, error: 'unparsed', ms };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    return { reply: null, error: name, ms: now() - startedAt };
  }
}
