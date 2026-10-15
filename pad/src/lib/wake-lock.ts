// Keeps the screen awake while the pad is joined, where supported (PROJECT.md Step 10).
// The browser drops the lock whenever the page is hidden, so it is asked for again
// each time the page becomes visible.

interface Sentinel {
  readonly released?: boolean;
  release(): Promise<void>;
}

export interface WakeLockEnv {
  wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
  isVisible(): boolean;
  onVisibilityChange(listener: () => void): () => void;
}

/** Holds a screen wake lock until the returned function is called. */
export function keepAwake(env: WakeLockEnv): () => void {
  const wakeLock = env.wakeLock;
  if (!wakeLock) return () => {};
  let sentinel: Sentinel | null = null;
  let isStopped = false;

  const acquire = () => {
    if (isStopped || !env.isVisible() || (sentinel && !sentinel.released)) return;
    wakeLock
      .request('screen')
      .then((lock) => {
        if (isStopped) void lock.release().catch(() => {});
        else sentinel = lock;
      })
      // Refused (battery saver, no permission): the screen just sleeps as usual.
      .catch(() => {});
  };

  const stopListening = env.onVisibilityChange(acquire);
  acquire();
  return () => {
    isStopped = true;
    stopListening();
    void sentinel?.release().catch(() => {});
    sentinel = null;
  };
}

/** The real browser environment for keepAwake. */
export function browserWakeLockEnv(): WakeLockEnv {
  return {
    wakeLock: 'wakeLock' in navigator ? navigator.wakeLock : undefined,
    isVisible: () => document.visibilityState === 'visible',
    onVisibilityChange(listener) {
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  };
}
