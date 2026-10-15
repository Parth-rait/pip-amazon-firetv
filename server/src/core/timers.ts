// Keyed timers: setting a key again replaces its timer, so a session never has two of one kind.

export interface Timers {
  set(key: string, ms: number, fn: () => void): void;
  clear(key: string): void;
  clearAll(): void;
}

export function createTimers(): Timers {
  const handles = new Map<string, NodeJS.Timeout>();
  return {
    set(key, ms, fn) {
      clearTimeout(handles.get(key));
      handles.set(
        key,
        setTimeout(() => {
          handles.delete(key);
          fn();
        }, ms),
      );
    },
    clear(key) {
      clearTimeout(handles.get(key));
      handles.delete(key);
    },
    clearAll() {
      for (const handle of handles.values()) clearTimeout(handle);
      handles.clear();
    },
  };
}
