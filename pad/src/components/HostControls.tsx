// The host's remote: back 10 s, play or pause, forward 10 s, and the quiz (section 3.3).
import type { HostCommand, Playback } from '../shared/protocol';
import { BackIcon, ForwardIcon, PauseIcon, PlayIcon } from './Icons';

const SKIP_SEC = 10;

interface Props {
  quizUnlocked: number;
  playback: Playback | null;
  onCommand: (command: HostCommand) => void;
}

export function HostControls({ quizUnlocked, playback, onCommand }: Props) {
  const isPaused = playback?.paused ?? false;
  const isEnded = playback?.ended ?? false;

  return (
    <section className="remote" aria-label="Host controls">
      <div className="remote__row">
        <button
          className="remote__button"
          onClick={() => onCommand({ type: 'seek', deltaSec: -SKIP_SEC })}
          aria-label="Back 10 seconds"
        >
          <BackIcon />
          <span className="remote__hint">10</span>
        </button>
        <button
          className="remote__button remote__button--main"
          onClick={() => onCommand({ type: isPaused ? 'play' : 'pause' })}
          aria-label={isPaused ? 'Play' : 'Pause'}
        >
          {isPaused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button
          className="remote__button"
          onClick={() => onCommand({ type: 'seek', deltaSec: SKIP_SEC })}
          aria-label="Forward 10 seconds"
        >
          <ForwardIcon />
          <span className="remote__hint">10</span>
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
