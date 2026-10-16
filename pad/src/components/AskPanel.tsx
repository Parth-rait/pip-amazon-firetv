// Ask Pip on the pad: chips, a text field and the mic; my reply with Done, which also hides Pip on
// the TV. Pip on the TV appears only after someone asks (PROJECT.md 3.3, vNext quiet default).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isSpeechSupported, listenOnce } from '../lib/speech';
import { LIMITS, type AskVia, type PipSay } from '../shared/protocol';
import type { AskFailure, PadState } from '../state/store';
import { Pip } from './Pip';

const ASK_ERRORS: Record<AskFailure, string> = {
  busy: 'Pip is answering someone else. Ask again in a moment.',
  'too-soon': 'One moment.',
  'not-watching': 'Pip answers questions while the film is on.',
  invalid: 'Type a question first.',
  'no-answer': "Pip didn't answer. Ask again in a moment.",
};
const MIC_FIRST_USE = 'Your browser turns your voice into text.';
const MIC_FAILED = 'Type your question instead.';

interface Props {
  chips: PadState['chips'];
  say: PipSay | null;
  isThinking: boolean;
  error: AskFailure | null;
  focusSignal: number; // changes when something (the Pip button) asks to open the Ask field
  onAsk: (text: string, via: AskVia) => void;
  onDone: () => void;
}

export function AskPanel({ chips, say, isThinking, error, focusSignal, onAsk, onDone }: Props) {
  const [text, setText] = useState('');
  const [micNote, setMicNote] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const stopListening = useRef<(() => void) | null>(null);
  const [canListen] = useState(isSpeechSupported);

  useEffect(() => {
    if (focusSignal > 0) input.current?.focus();
  }, [focusSignal]);
  useEffect(() => () => stopListening.current?.(), []);

  const send = (value: string, via: AskVia) => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || isThinking) return;
    onAsk(trimmed.slice(0, LIMITS.askMaxChars), via);
    setText('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(text, 'typed');
  };

  const listen = () => {
    if (isListening) return stopListening.current?.();
    setMicNote((note) => note ?? MIC_FIRST_USE);
    setIsListening(true);
    stopListening.current = listenOnce({
      onWords: setText,
      onDone: (heard) => {
        setIsListening(false);
        send(heard, 'voice');
      },
      onError: () => {
        setIsListening(false);
        setMicNote(MIC_FAILED);
      },
    });
  };

  const isQuiet =
    say && (say.kind === 'unknown' || say.kind === 'fallback' || say.kind === 'refused');

  return (
    <section className="ask" aria-label="Ask Pip">
      <div className="ask__head">
        <Pip state={isThinking ? 'thinking' : 'idle'} size={28} />
        <h2 className="title">Ask Pip</h2>
      </div>

      {isThinking && (
        <p className="caption" role="status">
          Pip is thinking…
        </p>
      )}

      {say && !isThinking && (
        <div className={isQuiet ? 'reply reply--quiet' : 'reply'} role="status" aria-live="polite">
          <p className="reply__text">{say.text}</p>
          <button className="button button--small" onClick={onDone}>
            Done
          </button>
        </div>
      )}

      <div className={chips.kind === 'clarify' ? 'chips chips--clarify' : 'chips'}>
        {chips.items.map((chip) => (
          <button
            key={chip}
            className="chip"
            disabled={isThinking}
            onClick={() => send(chip, chips.kind)}
          >
            {chip}
          </button>
        ))}
        {chips.kind === 'clarify' && (
          <button className="chip chip--quiet" onClick={() => input.current?.focus()}>
            Something else
          </button>
        )}
      </div>

      <form className="ask__form" onSubmit={submit}>
        <input
          ref={input}
          className="text-input"
          value={text}
          maxLength={LIMITS.askMaxChars}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about the film"
          aria-label="Your question for Pip"
          enterKeyHint="send"
        />
        <button
          className="button button--accent"
          type="submit"
          disabled={isThinking || text.trim().length < 2}
        >
          Ask
        </button>
        {canListen && (
          <button
            type="button"
            className={isListening ? 'button mic mic--on' : 'button mic'}
            onClick={listen}
            aria-label={isListening ? 'Stop listening' : 'Ask with your voice'}
            aria-pressed={isListening}
            disabled={isThinking}
          >
            <MicIcon />
          </button>
        )}
      </form>
      {error && <p className="error">{ASK_ERRORS[error]}</p>}
      {micNote && <p className="caption">{micNote}</p>}
    </section>
  );
}

function MicIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
