// The host's row for the film: back 10 s, play or pause, forward 10 s, progress, lobby and the quiz.
import { useEffect, useState } from 'react';
import { estimatePosition, formatTimeLeft } from '../lib/format';
import type { HostCommand, Playback } from '../shared/protocol';

const SKIP_SEC = 10;
const TICK_MS = 1000;

interface Props {
  quizUnlocked: number;
  playback: Playback | null;
  playbackAt: number;
  durationSec: number;
  onCommand: (command: HostCommand) => void;
}

export function HostControls({
  quizUnlocked,
  playback,
  playbackAt,
  durationSec,
  onCommand,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const position = playback ? estimatePosition(playback, playbackAt, now) : 0;
  const isPaused = playback?.paused ?? false;
  const isEnded = playback?.ended ?? false;
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
          className={isEnded ? 'button button--big' : 'button button--big button--accent'}
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
      <button
        className={isEnded ? 'button button--wide button--accent' : 'button button--wide'}
        disabled={quizUnlocked === 0}
        onClick={() => onCommand({ type: 'start-quiz' })}
      >
        {quizUnlocked === 0
          ? 'The quiz unlocks as you watch'
          : `Start the quiz (${quizUnlocked} ready)`}
      </button>
    </section>
  );
}
