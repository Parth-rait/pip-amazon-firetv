// An IntentJudge backed by TypeSafe's System One API (a typed `choice` judgement), for requests the
// deterministic rules could not place, such as "hold it a sec". Code keeps the policy: a confident
// "playback-command" only turns into explicit choices the person taps; nothing runs from it.
// The SDK (@typesafe-ai/sdk) is loaded only when INTENT_JUDGE=typesafe, and is not a dependency
// until a benchmark shows it helps (docs/engineering/open-source-adoption.md). The request shape
// below follows the SDK 0.7.0 type declarations; it has not been run against the live API.
import type { IntentJudge, IntentJudgement, JudgedIntent } from './core/intent/judge.js';

/** The part of TypeSafeClient this adapter uses (SDK 0.7.0 `systemOne`). */
export interface SystemOneClient {
  systemOne(
    request: { state: unknown; questions: Record<string, unknown> },
    options?: { timeout?: number },
  ): Promise<{ answers: Record<string, { choice?: string; confidence?: number } | undefined> }>;
}

const LABELS: Record<JudgedIntent, string> = {
  question: 'They are asking Pip something about the film or what is on screen.',
  'playback-command': 'They want the film played, paused, skipped forward or rewound.',
  dismiss: 'They want Pip to stop talking or go away.',
  other: 'Something else, or it is not clear.',
};

/** Builds the judge around any client with `systemOne`; tests pass a fake. */
export function createTypeSafeJudge(
  client: SystemOneClient,
  choice: (instructions: string, criteria: Record<string, string>) => unknown,
  timeoutMs: number,
): IntentJudge {
  return {
    name: 'typesafe',
    async judge(text): Promise<IntentJudgement | null> {
      try {
        const response = await client.systemOne(
          {
            state: {
              request: text,
              situation:
                'A family is watching a film on their TV and typed this to Pip, the helper on the TV.',
            },
            questions: {
              intent: choice('What does this person want Pip to do with `request`?', LABELS),
            },
          },
          { timeout: timeoutMs },
        );
        const answer = response.answers.intent;
        const label = answer?.choice as JudgedIntent | undefined;
        if (!label || !(label in LABELS) || typeof answer?.confidence !== 'number') return null;
        return { label, confidence: answer.confidence };
      } catch {
        return null; // the rules' answer stands when the judge is unavailable
      }
    },
  };
}

/** Loads the SDK at runtime. Returns null (rules only) when it or the key is missing. */
export async function loadTypeSafeJudge(timeoutMs: number): Promise<IntentJudge | null> {
  if (!process.env.TYPESAFE_API_KEY) return null;
  try {
    const name = '@typesafe-ai/sdk';
    const sdk = (await import(name)) as {
      TypeSafeClient: new () => SystemOneClient;
      choice: (instructions: string, criteria: Record<string, string>) => unknown;
    };
    return createTypeSafeJudge(new sdk.TypeSafeClient(), sdk.choice, timeoutMs);
  } catch {
    return null;
  }
}
