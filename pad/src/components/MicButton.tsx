// The mic: one question per tap, with the browser's speech recognition. Hidden where it does not exist.
import { useEffect, useRef, useState } from 'react';
import { isSpeechAvailable, listenOnce } from '../lib/speech';
import { MicIcon } from './Icons';

const HINT_KEY = 'pip.micHint';

interface Props {
  isDisabled: boolean;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onMessage: (message: string | null) => void;
}

function hasSeenHint(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true; // storage blocked: skip the hint rather than show it every time
  }
}

function markHintSeen(): void {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    // Storage blocked; the hint may show again next time, which is harmless.
  }
}

export function MicButton({ isDisabled, onPartial, onFinal, onMessage }: Props) {
  const [isListening, setIsListening] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  if (!isSpeechAvailable()) return null;

  const start = () => {
    if (isListening) {
      stop.current?.();
      return;
    }
    if (!hasSeenHint()) {
      markHintSeen();
      onMessage('Your browser turns your voice into text.');
    } else {
      onMessage(null);
    }
    setIsListening(true);
    stop.current = listenOnce({
      onPartial,
      onFinal: (text) => {
        setIsListening(false);
        onFinal(text);
      },
      onError: () => {
        setIsListening(false);
        onMessage('Type your question instead.');
      },
    });
    if (!stop.current) setIsListening(false);
  };

  return (
    <button
      type="button"
      className={isListening ? 'mic mic--on' : 'mic'}
      onClick={start}
      disabled={isDisabled && !isListening}
      aria-label={isListening ? 'Stop listening' : 'Ask by voice'}
      aria-pressed={isListening}
    >
      <MicIcon />
    </button>
  );
}
