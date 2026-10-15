// runAsk(): one guided model call that never throws (PROJECT.md section 5.3).
import { withTimeout, type TextModel } from './model.js';
import { parseReply, type ParsedReply } from './parse-reply.js';

export interface AskSettings {
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  allowClarify: boolean;
}

export type AskOutcome = { reply: ParsedReply } | { reply: null; error: string };

/** Calls the model and parses the reply. error is 'unparsed' or the thrown error's name. */
export async function runAsk(
  model: TextModel,
  prompt: { system: string; user: string },
  question: string,
  settings: AskSettings,
): Promise<AskOutcome> {
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
    return reply ? { reply } : { reply: null, error: 'unparsed' };
  } catch (error) {
    return { reply: null, error: error instanceof Error ? error.name : 'Error' };
  }
}
