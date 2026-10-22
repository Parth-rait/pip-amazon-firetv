// The watch screen's header: the film's still behind its title, where the film is, and (for the
// host) the way back to the films.
import { useEffect, useState } from 'react';
import { estimatePosition, formatClock, formatTimeLeft } from '../lib/format';
import type { ContentView, Playback } from '../shared/protocol';

const TICK_MS = 1000;

interface Props {
  content: ContentView | null;
  playback: Playback | null;
  playbackAt: number;
  onFilms?: () => void; // the host only
}

export function NowPlaying({ content, playback, playbackAt, onFilms }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const duration = content?.durationSec ?? 0;
  const position = playback ? estimatePosition(playback, playbackAt, now) : 0;
  const percent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const paused = playback?.paused && !playback.ended;
  return (
    <header className="now-playing">
      {content?.poster && <img className="now-playing__art" src={content.poster} alt="" />}
      <div className="now-playing__scrim" />
      <div className="now-playing__body">
        <div className="now-playing__top">
          <p className="label">
            {paused ? 'Paused' : playback?.ended ? 'Finished' : 'Now playing'}
          </p>
          {onFilms && (
            <button className="button button--small" onClick={onFilms}>
              Films
            </button>
          )}
        </div>
        <h1 className="large-title">{content?.title ?? 'Film'}</h1>
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress__fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="now-playing__times caption">
          <span>
            {formatClock(position)} / {formatClock(duration)}
          </span>
          <span>{formatTimeLeft(position, duration)}</span>
        </p>
      </div>
    </header>
  );
}
