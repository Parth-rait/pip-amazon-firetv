// The browser's own speech recognition (Web Speech API), one question per tap (PROJECT.md 4.8).
// Our server never receives audio, only the text.

// lib.dom has the event types but not the recognizer itself, so this is the part we use.
interface Recognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognizerClass = new () => Recognizer;

function recognizerClass(): RecognizerClass | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognizerClass;
    webkitSpeechRecognition?: RecognizerClass;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && recognizerClass() !== null;
}

export interface ListenHandlers {
  onPartial: (text: string) => void; // the words so far, to show in the Ask box
  onFinal: (text: string) => void; // the person stopped talking
  onError: () => void; // denied, no speech, or no network
}

/** Listens for one question. Returns a stop function, or null when speech is not available. */
export function listenOnce(handlers: ListenHandlers): (() => void) | null {
  const Recognition = recognizerClass();
  if (!Recognition) return null;
  const recognizer = new Recognition();
  recognizer.lang = navigator.language || 'en-US';
  recognizer.interimResults = true;
  recognizer.continuous = false;
  let heard = '';
  let isDone = false;

  recognizer.onresult = (event) => {
    heard = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? '')
      .join('')
      .trim();
    handlers.onPartial(heard);
    if (event.results[event.results.length - 1]?.isFinal && !isDone) {
      isDone = true;
      handlers.onFinal(heard);
    }
  };
  recognizer.onerror = () => {
    if (isDone) return;
    isDone = true;
    handlers.onError();
  };
  recognizer.onend = () => {
    if (isDone) return;
    isDone = true;
    // Some browsers end without a final result; what was heard is still the question.
    if (heard) handlers.onFinal(heard);
    else handlers.onError();
  };
  try {
    recognizer.start();
  } catch {
    handlers.onError();
    return null;
  }
  return () => recognizer.stop();
}
