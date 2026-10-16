// One tap, one sentence: a command ("pause", "back 10", "louder", "movie lights") runs at once with
// no model; anything else is a question for Pip.
import { useEffect, useRef, useState } from 'react';
import { describeCommand, parseCommand } from '../lib/commands';
import { isSpeechAvailable, listenOnce } from '../lib/speech';
import type { PipInputEvent } from '../shared/protocol';
import { MicIcon } from './Icons';

interface Props {
  onCommand: (event: PipInputEvent) => void;
  onQuestion: (text: string) => void;
}

export function VoiceButton({ onCommand, onQuestion }: Props) {
  const [heard, setHeard] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  if (!isSpeechAvailable()) return null;

  const start = () => {
    if (isListening) {
      stop.current?.();
      return;
    }
    setHeard(null);
    setIsListening(true);
    stop.current = listenOnce({
      onPartial: (text) => setHeard(text),
      onFinal: (text) => {
        setIsListening(false);
        const command = parseCommand(text);
        if (command) {
          setHeard(`${describeCommand(command)} ("${text}")`);
          onCommand(command);
        } else if (text.trim().length >= 2) {
          setHeard(null);
          onQuestion(text.trim());
        }
      },
      onError: () => {
        setIsListening(false);
        setHeard("I didn't catch that. Try again.");
      },
    });
    if (!stop.current) setIsListening(false);
  };

  return (
    <div className="voice">
      <button
        className={isListening ? 'voice__button is-on' : 'voice__button'}
        onClick={start}
        aria-pressed={isListening}
      >
        <MicIcon />
        <span>{isListening ? 'Listening...' : 'Tap and say "pause", "back 10" or "louder"'}</span>
      </button>
      {heard && <p className="caption">{heard}</p>}
    </div>
  );
}
