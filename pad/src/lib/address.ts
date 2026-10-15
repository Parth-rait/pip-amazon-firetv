// Reads the join link: a ?code= in the address wins over the saved code (PROJECT.md 4.5, Join).
import { cleanCodeInput, isFullCode } from './format';
import { saveCode } from './player-id';

/** Saves a ?code= from the address, then removes it, so "Join another TV" is not undone by a reload. */
export function takeCodeFromAddress(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('code')) return;
  const code = cleanCodeInput(url.searchParams.get('code') ?? '');
  if (isFullCode(code)) saveCode(code);
  url.searchParams.delete('code');
  window.history.replaceState(null, '', url);
}
