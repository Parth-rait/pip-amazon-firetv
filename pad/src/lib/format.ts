// Small text helpers shared by the screens.
import { CODE_ALPHABET, LIMITS, type Playback } from '../shared/protocol';

/** "About 6 min left", or "Less than a minute left". */
export function formatTimeLeft(positionSec: number, durationSec: number): string {
  const minutes = Math.round(Math.max(0, durationSec - positionSec) / 60);
  return minutes < 1 ? 'Less than a minute left' : `About ${minutes} min left`;
}

/** "4:05": minutes and seconds of the film. */
export function formatClock(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function formatMinutes(durationSec: number): string {
  return `${Math.max(1, Math.round(durationSec / 60))} min`;
}

/** Capitals from the code alphabet only, cut to the code length. */
export function cleanCodeInput(raw: string): string {
  return [...raw.toUpperCase()]
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, LIMITS.codeLength);
}

export function isFullCode(code: string): boolean {
  return cleanCodeInput(code) === code && code.length === LIMITS.codeLength;
}

/** The TV's last report moved on by the time since it arrived, while playing. */
export function estimatePosition(playback: Playback, receivedAt: number, nowMs: number): number {
  if (playback.ended) return playback.durationSec;
  const elapsed = playback.paused ? 0 : Math.max(0, nowMs - receivedAt) / 1000;
  return Math.min(playback.positionSec + elapsed, playback.durationSec);
}

/** The first letter of a name, as a capital, for avatars ("?" when there is none). */
export function initialOf(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase() : '?';
}
