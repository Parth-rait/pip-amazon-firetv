// Ask Pip on the watch screen: chips, the Ask box with the mic, and my latest answer.
import { useRef, useState } from 'react';
import type { AskResult, AskVia, PipSay } from '../shared/protocol';
import type { ChipKind } from '../state/store';
import { AnswerCard } from './AnswerCard';
import { AskBox } from './AskBox';
import { Chips } from './Chips';

type Refusal = Extract<AskResult, { ok: false }>['reason'];

const REFUSALS: Record<Refusal, string> = {
  busy: 'Pip is answering someone else. Ask again in a moment.',
  'too-soon': 'One moment.',
  'not-watching': 'Pip answers questions while the film is on.',
  invalid: 'Type a question first.',
};
const NO_ANSWER = "Pip didn't hear that. Ask again in a moment.";

interface Props {
  chips: { kind: ChipKind; items: string[] };
  say: PipSay | null;
  isThinking: boolean;
  onAsk: (text: string, via: AskVia) => Promise<AskResult | null>;
  onSomethingElse: () => void;
}

export function AskPip({ chips, say, isThinking, onAsk, onSomethingElse }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isDisabled = isThinking || isSending;

  const ask = async (text: string, via: AskVia) => {
    setMessage(null);
    setIsSending(true);
    const result = await onAsk(text, via);
    setIsSending(false);
    if (!result) setMessage(NO_ANSWER);
    else if (!result.ok) setMessage(REFUSALS[result.reason]);
  };

  return (
    <section className="ask-pip" aria-label="Ask Pip">
      <Chips
        kind={chips.kind}
        items={chips.items}
        isDisabled={isDisabled}
        onAsk={(text, via) => void ask(text, via)}
        onSomethingElse={() => {
          onSomethingElse();
          input.current?.focus();
        }}
      />
      {isThinking && <p className="caption thinking">Pip is thinking</p>}
      <AnswerCard say={say} />
      <AskBox
        inputRef={input}
        isDisabled={isDisabled}
        onAsk={(text, via) => void ask(text, via)}
        message={message}
        onMessage={setMessage}
      />
    </section>
  );
}
