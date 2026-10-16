// An optional typed semantic judgement for routing text the rules could not place.
// It may only steer a request to explicit choices; it never executes an action itself.

export type JudgedIntent = 'question' | 'playback-command' | 'dismiss' | 'other';

export interface IntentJudgement {
  label: JudgedIntent;
  confidence: number; // 0..1 as reported by the judge
}

/** Implemented by the rules-only judge (default) and by adapters such as TypeSafe's. */
export interface IntentJudge {
  readonly name: string;
  judge(text: string): Promise<IntentJudgement | null>; // null when unavailable or failed
}

/** The default: no semantic model, so the rules' answer stands. */
export const noJudge: IntentJudge = {
  name: 'rules-only',
  judge: async () => null,
};

/** Only a confident command-like judgement changes anything, and only into a clarify prompt. */
export function shouldOfferCommandChoices(
  judgement: IntentJudgement | null,
  threshold: number,
): boolean {
  return (
    judgement !== null &&
    judgement.label === 'playback-command' &&
    judgement.confidence >= threshold
  );
}
