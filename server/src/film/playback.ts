// Where the film is now, from the TV's last report (PROJECT.md section 5.3).
import type { Playback } from '../shared/protocol.js';

/** The last reported position plus the time since, while playing; never past the end. */
export function estimatePosition(playback: Playback, playbackAt: number, nowMs: number): number {
  if (playback.ended) return playback.durationSec;
  const elapsedSec = playback.paused ? 0 : Math.max(0, nowMs - playbackAt) / 1000;
  return Math.min(playback.positionSec + elapsedSec, playback.durationSec);
}
