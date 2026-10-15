// The host's row for the film: back 10 s, play or pause, forward 10 s, progress, lobby and the quiz.
import { useEffect, useState } from 'react';
import { estimatePosition, formatTimeLeft } from '../lib/format';
import type { HostCommand, Playback } from '../shared/protocol';

const SKIP_SEC = 10;
const TICK_MS = 1000;

interface Props {
  playback: Playback | null;
  playbackAt: number;
  durationSec: number;
  onCommand: (command: HostCommand) => void;
}

export function HostControls({ playback, playbackAt, durationSec, onCommand }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const position = playback ? estimatePosition(playback, playbackAt, now) : 0;
  const isPaused = playback?.paused ?? false;
  const percent = durationSec > 0 ? Math.min(100, (position / durationSec) * 100) : 0;

  return (
    <section className="host-controls" aria-label="Host controls">
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="caption">{formatTimeLeft(position, durationSec)}</p>
      <div className="control-row">
        <button
          className="button button--big"
          onClick={() => onCommand({ type: 'seek', deltaSec: -SKIP_SEC })}
          aria-label="Back 10 seconds"
        >
          −10 s
        </button>
        <button
          className="button button--big button--accent"
          onClick={() => onCommand({ type: isPaused ? 'play' : 'pause' })}
        >
          {isPaused ? 'Play' : 'Pause'}
        </button>
        <button
          className="button button--big"
          onClick={() => onCommand({ type: 'seek', deltaSec: SKIP_SEC })}
          aria-label="Forward 10 seconds"
        >
          +10 s
        </button>
      </div>
      {/* The quiz arrives in Step 9; until then the button explains itself and stays off. */}
      <button className="button button--wide" disabled>
        The quiz unlocks as you watch
      </button>
    </section>
  );
}
