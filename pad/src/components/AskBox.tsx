// The Ask bar at the bottom of the screen: type a question (or say it with the mic) and send it.
import { useState, type FormEvent, type Ref } from 'react';
import { LIMITS, type AskVia } from '../shared/protocol';
import { SendIcon } from './Icons';
import { MicButton } from './MicButton';

interface Props {
  isDisabled: boolean; // while Pip is thinking
  onAsk: (text: string, via: AskVia) => void;
  message: string | null; // a refused ask, or a mic line
  onMessage: (message: string | null) => void;
  inputRef?: Ref<HTMLInputElement>; // "Something else" focuses the box
}

export function AskBox({ isDisabled, onAsk, message, onMessage, inputRef }: Props) {
  const [text, setText] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const question = text.trim();
    if (question.length < 2) {
      onMessage('Type a question first.');
      return;
    }
    onAsk(question, 'typed');
    setText('');
  };

  return (
    <form className="ask-bar" onSubmit={submit}>
      {message && <p className="caption ask-bar__message">{message}</p>}
      <div className="ask-bar__row">
        <input
          ref={inputRef}
          className="ask-bar__input"
          value={text}
          maxLength={LIMITS.askMaxChars}
          placeholder="Ask Pip about the film"
          onChange={(e) => setText(e.target.value)}
          aria-label="Your question"
        />
        <MicButton
          isDisabled={isDisabled}
          onPartial={setText}
          onFinal={(heard) => {
            setText('');
            if (heard.trim().length >= 2) onAsk(heard.trim(), 'voice');
          }}
          onMessage={onMessage}
        />
        <button
          className="send"
          type="submit"
          disabled={isDisabled || text.trim().length < 2}
          aria-label="Ask Pip"
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
}
