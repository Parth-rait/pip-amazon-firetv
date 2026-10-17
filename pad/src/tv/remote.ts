// The keyboard as a Fire TV remote: arrows are the D-pad, Enter is OK, Escape or Backspace is
// Back, Space and the media keys are play/pause, rewind and fast-forward.
import { useEffect, useRef } from 'react';

export type RemoteKey =
  'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'playPause' | 'rewind' | 'forward';

const KEYS: Record<string, RemoteKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'select',
  Escape: 'back',
  Backspace: 'back',
  BrowserBack: 'back',
  ' ': 'playPause',
  k: 'playPause',
  MediaPlayPause: 'playPause',
  MediaRewind: 'rewind',
  MediaTrackPrevious: 'rewind',
  MediaFastForward: 'forward',
  MediaTrackNext: 'forward',
};

export function remoteKey(event: Pick<KeyboardEvent, 'key'>): RemoteKey | null {
  return KEYS[event.key] ?? null;
}

/**
 * Calls onKey for each remote key while the screen is mounted. The latest onKey is used, so
 * callers need not memoise it. A key typed into a field is left alone.
 */
export function useRemote(onKey: (key: RemoteKey, event: KeyboardEvent) => void): void {
  const handler = useRef(onKey);
  useEffect(() => {
    handler.current = onKey;
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const key = remoteKey(event);
      if (!key) return;
      event.preventDefault();
      handler.current(key, event);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
