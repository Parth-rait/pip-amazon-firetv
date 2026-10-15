// Fullscreen on the first tap, where the browser supports it (PROJECT.md Step 10).
// Browsers only allow it from a tap, so it waits for one. iPhone Safari has no page
// fullscreen; there the pad simply stays as it is.

export interface FullscreenDoc {
  fullscreenEnabled?: boolean;
  fullscreenElement: Element | null;
  documentElement: { requestFullscreen?: (options?: FullscreenOptions) => Promise<void> };
  addEventListener(type: 'pointerdown', listener: () => void, options: { once: true }): void;
  removeEventListener(type: 'pointerdown', listener: () => void): void;
}

/** Asks for fullscreen on the first tap only; returns a function that stops waiting. */
export function fullscreenOnFirstTap(doc: FullscreenDoc, isTouch: boolean): () => void {
  if (!isTouch || !doc.fullscreenEnabled || !doc.documentElement.requestFullscreen) {
    return () => {};
  }
  const onTap = () => {
    if (doc.fullscreenElement) return;
    // A refusal (an old browser, a setting) changes nothing for the person.
    doc.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
  };
  doc.addEventListener('pointerdown', onTap, { once: true });
  return () => doc.removeEventListener('pointerdown', onTap);
}
