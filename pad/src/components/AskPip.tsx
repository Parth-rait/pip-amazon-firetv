// Ask Pip as a chat: my last question, Pip's answer in its bubble, the chips, and the Ask bar
// at the bottom of the screen.
import { useRef, useState } from 'react';
import type { AskResult, AskVia, PipSay, PipState } from '../shared/protocol';
import type { ChipKind } from '../state/store';
import { AskBox } from './AskBox';
import { Chips } from './Chips';
import { Pip } from './Pip';

type Refusal = Extract<AskResult, { ok: false }>['reason'];

const REFUSALS: Record<Refusal, string> = {
  busy: 'Pip is answering someone else. Ask again in a moment.',
  'too-soon': 'One moment.',
  'not-watching': 'Pip answers questions while the film is on.',
  invalid: 'Type a question first.',
};
const NO_ANSWER = "Pip didn't hear that. Ask again in a moment.";
const HELLO = 'Ask me anything about the film. No spoilers, promise.';

interface Props {
  pip: PipState;
  chips: { kind: ChipKind; items: string[] };
  say: PipSay | null;
  isThinking: boolean;
  onAsk: (text: string, via: AskVia) => Promise<AskResult | null>;
  // Runs typed text as a command when it is one and says what happened; null for a question.
  onCommandText?: (text: string) => Promise<string | null>;
  onSomethingElse: () => void;
}

export function AskPip(props: Props) {
  const { pip, chips, say, isThinking, onAsk, onCommandText, onSomethingElse } = props;
  const [message, setMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  // The question I sent, and the answer showing then: it is pending until a new answer comes.
  const [sent, setSent] = useState<{ text: string; before: PipSay | null } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const isDisabled = isThinking || isSending;
  const pending = sent && sent.before === say ? sent.text : null;

  const ask = async (text: string, via: AskVia) => {
    setMessage(null);
    setIsSending(true);
    const done = via === 'typed' && onCommandText ? await onCommandText(text) : null;
    if (done !== null) {
      setIsSending(false);
      setMessage(done);
      return;
    }
    const result = await onAsk(text, via);
    setIsSending(false);
    if (!result) setMessage(NO_ANSWER);
    else if (!result.ok) setMessage(REFUSALS[result.reason]);
    else setSent({ text, before: say });
  };

  const question = pending ?? say?.question ?? null;
  const answer = pending ? null : say && say.clarify.length === 0 ? say.text : null;
  const isWaiting = pending !== null;

  return (
    <section className="ask-pip" aria-label="Ask Pip">
      <div className="conversation" aria-live="polite">
        {question && <p className="bubble bubble--me">{question}</p>}
        <div className="pip-line">
          <Pip state={isWaiting ? 'thinking' : pip === 'sleep' ? 'idle' : pip} size={36} />
          <p
            className={`bubble bubble--pip${say?.source === 'imagined' && !isWaiting ? ' bubble--story' : ''}`}
          >
            {say?.source === 'imagined' && !isWaiting && (
              <span className="bubble__tag">What if, made up by Pip</span>
            )}
            {isWaiting ? (
              <span className="typing" aria-label="Pip is thinking">
                <span />
                <span />
                <span />
              </span>
            ) : say?.clarify.length ? (
              say.text
            ) : (
              (answer ?? HELLO)
            )}
          </p>
        </div>
      </div>
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
