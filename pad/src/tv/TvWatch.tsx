// WATCH on the TV: the film full screen and nothing else, until someone asks Pip. Reports playback
// on every change and every 5 s; applies host commands; forwards remote keys as tv:input.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pip } from '../components/Pip';
import type {
  ContentView,
  InputEnvelope,
  Playback,
  RemoteKey,
  SessionView,
  TvCommand,
} from '../shared/protocol';
import type { TvSocket } from './TvApp';

const REPORT_EVERY_MS = 5000;
const CREDIT_MS = 4000;
const PAUSE_BAR_MS = 3000;

const KEYS: Record<string, RemoteKey> = {
  ' ': 'play-pause',
  Enter: 'play-pause',
  MediaPlayPause: 'play-pause',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  MediaRewind: 'rewind',
  MediaFastForward: 'fast-forward',
  Escape: 'back',
  Backspace: 'back',
};

interface Props {
  socket: TvSocket;
  view: SessionView;
  content: ContentView;
  onReport: (playback: Playback) => void;
  setCommandHandler: (handler: ((command: TvCommand) => void) | null) => void;
}

/**
 * The simulator runs in browsers that may lack H.264 (open-source Chromium), so it falls back to a
 * .webm file next to the .mp4. The Vega app on Fire TV plays the MP4 itself.
 */
function playableUrl(url: string): string {
  const canMp4 =
    document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"') !== '';
  return canMp4 ? url : url.replace(/\.mp4(\?|$)/, '.webm$1');
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function eventId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `tv${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function TvWatch({ socket, view, content, onReport, setCommandHandler }: Props) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [showCredit, setShowCredit] = useState(true);
  const [pausedAtSec, setPausedAtSec] = useState<number | null>(null); // shows the pause bar
  const [isBroken, setIsBroken] = useState(false);
  const muted = new URLSearchParams(window.location.search).get('sound') !== '1';

  useEffect(() => {
    const timer = setTimeout(() => setShowCredit(false), CREDIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (pausedAtSec === null) return;
    const timer = setTimeout(() => setPausedAtSec(null), PAUSE_BAR_MS);
    return () => clearTimeout(timer);
  }, [pausedAtSec]);

  const report = useCallback(() => {
    const el = video.current;
    if (!el) return;
    const playback: Playback = {
      contentId: content.id,
      positionSec: el.currentTime,
      durationSec: content.durationSec,
      paused: el.paused,
      ended: el.ended,
    };
    onReport(playback);
    socket.emit('tv:playback', playback);
  }, [content.id, content.durationSec, onReport, socket]);

  useEffect(() => {
    setCommandHandler((command) => {
      const el = video.current;
      if (!el) return;
      if (command.type === 'play') void el.play().catch(() => report());
      if (command.type === 'pause') el.pause();
      if (command.type === 'seek') {
        el.currentTime = Math.min(
          Math.max(el.currentTime + command.deltaSec, 0),
          content.durationSec,
        );
      }
    });
    const timer = setInterval(() => {
      if (video.current && !video.current.paused) report();
    }, REPORT_EVERY_MS);
    const onKey = (event: KeyboardEvent) => {
      const key = KEYS[event.key];
      if (!key) return;
      event.preventDefault();
      const input: InputEnvelope = {
        v: 1,
        eventId: eventId(),
        source: 'remote',
        sentAt: Date.now(),
        input: { kind: 'key', key },
      };
      socket.emit('tv:input', input);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      setCommandHandler(null);
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [socket, content.durationSec, report, setCommandHandler]);

  const resume = () => {
    const el = video.current;
    const saved = view.playback;
    if (el && saved && saved.contentId === content.id && !saved.ended)
      el.currentTime = saved.positionSec;
  };

  const assist = view.assist;
  const isQuiet = assist?.kind === 'unknown' || assist?.kind === 'fallback';

  return (
    <main className="tv-watch">
      <video
        ref={video}
        className="tv-video"
        src={playableUrl(content.url)}
        autoPlay
        muted={muted}
        playsInline
        onLoadedMetadata={resume}
        onPlay={report}
        onPause={(event) => {
          report();
          setPausedAtSec(event.currentTarget.currentTime);
        }}
        onPlaying={() => setPausedAtSec(null)}
        onSeeked={report}
        onEnded={report}
        onError={() => setIsBroken(true)}
      />
      {isBroken && <p className="tv-message">The film didn't load.</p>}
      {showCredit && !assist && <p className="tv-credit">{content.credit}</p>}
      {pausedAtSec !== null && (
        <div className="tv-pausebar">
          <span>{content.title}</span>
          <span>{clock(pausedAtSec)}</span>
        </div>
      )}
      {assist && (
        <aside
          className={assist.phase === 'thinking' ? 'tv-assist tv-assist--thinking' : 'tv-assist'}
          aria-live="polite"
        >
          <div className="tv-assist__bubble">
            <p className="tv-assist__asked">
              {assist.askedByName} asked: {assist.question}
            </p>
            {assist.text && (
              <p className={isQuiet ? 'tv-assist__text tv-assist__text--quiet' : 'tv-assist__text'}>
                {assist.text}
              </p>
            )}
          </div>
          <Pip state={view.pip} size={96} />
        </aside>
      )}
    </main>
  );
}
