// The browser's own speech recognition (Web Speech API), where it exists. One question per tap.
// The browser may send audio to its maker's speech service; our server only ever gets the text.

interface RecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return recognitionClass() !== null;
}

export interface ListenHandlers {
  onWords: (text: string) => void; // what has been heard so far
  onDone: (text: string) => void; // the final text, when the person stops talking
  onError: (kind: 'denied' | 'failed') => void;
}

/** Listens for one question. Returns a function that stops listening early. */
export function listenOnce(handlers: ListenHandlers): () => void {
  const Ctor = recognitionClass();
  if (!Ctor) {
    handlers.onError('failed');
    return () => {};
  }
  const recognition = new Ctor();
  recognition.lang = navigator.language || 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let heard = '';
  let isFinished = false;
  recognition.onresult = (event) => {
    heard = Array.from(
      { length: event.results.length },
      (_, i) => event.results[i]?.[0].transcript ?? '',
    ).join('');
    handlers.onWords(heard);
  };
  recognition.onerror = (event) => {
    isFinished = true;
    handlers.onError(
      event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'failed',
    );
  };
  recognition.onend = () => {
    if (isFinished) return;
    isFinished = true;
    if (heard.trim()) handlers.onDone(heard.trim());
    else handlers.onError('failed');
  };
  recognition.start();
  return () => recognition.stop();
}
