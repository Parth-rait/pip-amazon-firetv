import { describe, expect, it, vi } from 'vitest';
import { fullscreenOnFirstTap, type FullscreenDoc } from './fullscreen';

function fakeDoc(enabled = true) {
  let onTap: (() => void) | null = null;
  const requestFullscreen = vi.fn(async () => {});
  const doc: FullscreenDoc = {
    fullscreenEnabled: enabled,
    fullscreenElement: null,
    documentElement: { requestFullscreen },
    addEventListener: (_type, listener) => (onTap = listener),
    removeEventListener: () => (onTap = null),
  };
  return { doc, requestFullscreen, tap: () => onTap?.() };
}

describe('fullscreenOnFirstTap', () => {
  it('asks for fullscreen on the first tap of a touch screen', () => {
    const { doc, requestFullscreen, tap } = fakeDoc();
    fullscreenOnFirstTap(doc, true);
    tap();
    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  it('leaves desktops and browsers without fullscreen alone', () => {
    const desktop = fakeDoc();
    fullscreenOnFirstTap(desktop.doc, false);
    desktop.tap();
    const iphone = fakeDoc(false);
    fullscreenOnFirstTap(iphone.doc, true);
    iphone.tap();
    expect(desktop.requestFullscreen).not.toHaveBeenCalled();
    expect(iphone.requestFullscreen).not.toHaveBeenCalled();
  });

  it('stops waiting when cleaned up', () => {
    const { doc, requestFullscreen, tap } = fakeDoc();
    fullscreenOnFirstTap(doc, true)();
    tap();
    expect(requestFullscreen).not.toHaveBeenCalled();
  });
});
