// A thin progress line and "About N min left", for everyone on the watch screen.
import { useEffect, useState } from 'react';
import { estimatePosition, formatTimeLeft } from '../lib/format';
import type { Playback } from '../shared/protocol';

const TICK_MS = 1000;

interface Props {
  playback: Playback | null;
  playbackAt: number;
  durationSec: number;
}

export function FilmProgress({ playback, playbackAt, durationSec }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const position = playback ? estimatePosition(playback, playbackAt, now) : 0;
  const percent = durationSec > 0 ? Math.min(100, (position / durationSec) * 100) : 0;
  return (
    <div className="film-progress">
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="caption">
        {playback?.paused && !playback.ended ? 'Paused. ' : ''}
        {formatTimeLeft(position, durationSec)}
      </p>
    </div>
  );
}
