// The host's row for the film: back 10 s, play or pause, forward 10 s, progress, and what the TV
// actually did with the last command. No quiz button here: the quiz is an opt-in mode.
import { useEffect, useState } from 'react';
import { estimatePosition, formatTimeLeft } from '../lib/format';
import { newId } from '../lib/ids';
import type { ActionView, HostCommand, Playback } from '../shared/protocol';
import { actionLine } from '../state/store';

const SKIP_SEC = 10;
const TICK_MS = 1000;
const DONE_LINE_MS = 2500;

interface Props {
  playback: Playback | null;
  playbackAt: number;
  durationSec: number;
  lastAction: ActionView | null;
  onCommand: (command: HostCommand) => void;
}

export function HostControls({ playback, playbackAt, durationSec, lastAction, onCommand }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [hiddenDone, setHiddenDone] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  // A "done" line fades after a moment; "sent" and "unconfirmed" stay until something changes.
  useEffect(() => {
    if (lastAction?.status !== 'done') return;
    const timer = setTimeout(() => setHiddenDone(lastAction.commandId), DONE_LINE_MS);
    return () => clearTimeout(timer);
  }, [lastAction]);

  const position = playback ? estimatePosition(playback, playbackAt, now) : 0;
  const isPaused = playback?.paused ?? false;
  const percent = durationSec > 0 ? Math.min(100, (position / durationSec) * 100) : 0;
  const line = lastAction && hiddenDone !== lastAction.commandId ? actionLine(lastAction) : null;
  const send = (command: HostCommand) =>
    onCommand({ ...command, commandId: newId('p') } as HostCommand);

  return (
    <section className="host-controls" aria-label="Host controls">
      <div
        className="progress"
        role="progressbar"
        aria-label="Film progress"
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
          onClick={() => send({ type: 'seek', deltaSec: -SKIP_SEC })}
          aria-label="Back 10 seconds"
        >
          −10 s
        </button>
        <button
          className="button button--big button--accent"
          onClick={() => send({ type: isPaused ? 'play' : 'pause' })}
        >
          {isPaused ? 'Play' : 'Pause'}
        </button>
        <button
          className="button button--big"
          onClick={() => send({ type: 'seek', deltaSec: SKIP_SEC })}
          aria-label="Forward 10 seconds"
        >
          +10 s
        </button>
      </div>
      <p
        className={
          lastAction?.status === 'unconfirmed'
            ? 'caption action-line action-line--warn'
            : 'caption action-line'
        }
        role="status"
        aria-live="polite"
      >
        {line ?? ' '}
      </p>
    </section>
  );
}
