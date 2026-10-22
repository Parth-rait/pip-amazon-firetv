// WATCH on the browser TV: the Vega watch screen (tv/src/screens/WatchScreen.tsx) on an HTML5
// video. The film is full screen and Pip stays hidden while it plays (docs/vnext/PLAN.md 3.1);
// Pip shows when someone opens it on a pad, while paused, and with an answer. Commands from the
// pads and gestures arrive as tv:command and are confirmed with tv:applied. The keyboard is the
// remote: those act on the player directly, as the Fire TV remote does, and the playback report
// tells the server. It stays mounted under the quiz and the results, so "Keep watching" is instant.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pip } from '../components/Pip';
import type {
  ContentView,
  Playback,
  ReactionKind,
  SessionView,
  TvCommand,
} from '../shared/protocol';
import { Bubble } from './Bubble';
import { PlayIcon } from './Home';
import { local, setHelloPlayback, type TvSocket } from './net';
import { useRemote } from './remote';
import { clock, type ReactionEntry, type SayEntry } from './store';

const REPORT_EVERY_MS = 5000;
const CREDIT_MS = 4000;
const CHROME_MS = 3500;
const ANSWER_MS = 8000;
const STORY_MS = 25000; // a made-up "what if" story takes longer to read
const TOAST_MS = 1600;
const SEEK_SEC = 10;
const MIN_BRIGHTNESS = 0.3;

const REACTION_FACE: Record<ReactionKind, string> = {
  laugh: '😂',
  wow: '😮',
  love: '😍',
  scared: '😱',
};

type Report = Omit<Playback, 'contentId'>;

export function Player({
  socket,
  view,
  content,
  say,
  reactions,
  fromStart,
  onHome,
  onReactionDone,
}: {
  socket: TvSocket;
  view: SessionView;
  content: ContentView;
  say: SayEntry | null;
  reactions: ReactionEntry[];
  fromStart: boolean; // the family chose Start over
  onHome: () => void;
  onReactionDone: (id: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = view.stage === 'watch';
  const activeRef = useRef(active);
  const viewRef = useRef(view);
  // Before any other effect, so they all see this render's stage and view.
  useLayoutEffect(() => {
    activeRef.current = active;
    viewRef.current = view;
  });
  const loadedRef = useRef(false);
  const fromStartRef = useRef(fromStart); // read once, when the film loads

  const [report, setReport] = useState<Report>({
    positionSec: 0,
    durationSec: content.durationSec,
    paused: true,
    ended: false,
  });
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [brightness, setBrightness] = useState(view.device.brightness);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // The transport bar: shown on any remote key or mouse move, hidden again after 3.5 s of play.
  const [chrome, setChrome] = useState(false);
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = useCallback(() => {
    setChrome(true);
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChrome(false), CHROME_MS);
  }, []);
  useEffect(
    () => () => {
      if (chromeTimer.current) clearTimeout(chromeTimer.current);
    },
    [],
  );

  const flash = useCallback((text: string) => {
    setToast((t) => ({ id: (t?.id ?? 0) + 1, text }));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const read = useCallback((): Report | null => {
    const v = videoRef.current;
    if (!v) return null;
    const r: Report = {
      positionSec: Number.isFinite(v.currentTime) ? v.currentTime : 0,
      durationSec: Number.isFinite(v.duration) ? v.duration : content.durationSec,
      paused: v.paused,
      ended: v.ended,
    };
    setReport(r);
    return r;
  }, [content.durationSec]);

  const send = useCallback(() => {
    const r = read();
    if (!r) return;
    const playback: Playback = { contentId: content.id, ...r };
    setHelloPlayback(activeRef.current ? playback : null);
    socket.emit('tv:playback', playback);
  }, [read, content.id, socket]);

  /** Resolves true once playing. A browser that blocks sound before a click plays muted. */
  const play = useCallback(async (): Promise<boolean> => {
    const v = videoRef.current;
    if (!v) return false;
    try {
      await v.play();
      return true;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') return false;
      v.muted = true;
      setSoundBlocked(true);
      try {
        await v.play();
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  const pause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return false;
    v.pause();
    return true;
  }, []);

  const seekBy = useCallback((deltaSec: number) => {
    const v = videoRef.current;
    if (!v) return false;
    const end = Number.isFinite(v.duration) ? v.duration : v.currentTime + Math.max(deltaSec, 0);
    v.currentTime = Math.min(Math.max(v.currentTime + deltaSec, 0), end);
    return true;
  }, []);

  const setVolume = useCallback((level: number) => {
    const v = videoRef.current;
    if (!v) return false;
    v.volume = Math.min(Math.max(level, 0), 1);
    return true;
  }, []);

  const unmute = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.muted) return;
    v.muted = false;
    setSoundBlocked(false);
  }, []);

  // Load the film at the resume point: the server's playback for this film, unless it ended or
  // the family chose Start over.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const last = viewRef.current.playback;
    const resume =
      !fromStartRef.current && last && last.contentId === content.id && !last.ended
        ? last.positionSec
        : 0;
    v.volume = viewRef.current.device.volume;
    const onMeta = () => {
      if (resume > 0) v.currentTime = Math.min(resume, Math.max(0, v.duration - 1));
      loadedRef.current = true;
      setLoaded(true);
      if (activeRef.current) {
        void play();
        setShowCredit(true);
      }
    };
    v.addEventListener('loadedmetadata', onMeta, { once: true });
    v.src = local(content.url);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [content.id, content.url, play]);

  // Pause when the stage leaves watch (the quiz covers the film); play again when it comes back.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !loadedRef.current) return;
    if (active) {
      if (v.ended) v.currentTime = 0;
      // play() sets state only after the browser answers, never synchronously
      // oxlint-disable-next-line react/set-state-in-effect
      void play();
    } else {
      setHelloPlayback(null);
      v.pause();
    }
  }, [active, play]);

  useEffect(
    () => () => {
      setHelloPlayback(null);
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.removeAttribute('src');
        v.load();
      }
    },
    [],
  );

  // Tell the server on every change, and every 5 s while playing.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => void read();
    const onError = () => setFailed(true);
    for (const type of ['play', 'pause', 'seeked', 'ended']) v.addEventListener(type, send);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('error', onError);
    const timer = setInterval(() => {
      if (!v.paused && !v.ended) send();
    }, REPORT_EVERY_MS);
    return () => {
      for (const type of ['play', 'pause', 'seeked', 'ended']) v.removeEventListener(type, send);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('error', onError);
      clearInterval(timer);
    };
  }, [read, send]);

  useEffect(() => {
    if (!showCredit) return;
    const t = setTimeout(() => setShowCredit(false), CREDIT_MS);
    return () => clearTimeout(t);
  }, [showCredit]);

  // The pads' and gestures' commands, confirmed with tv:applied so the pad says "done" only
  // when the film really did it (docs/vnext/PLAN.md 8).
  useEffect(() => {
    const apply = async (command: TvCommand): Promise<boolean> => {
      switch (command.type) {
        case 'play':
          return play();
        case 'pause':
          return pause();
        case 'seek':
          return seekBy(command.deltaSec);
        case 'volume':
          return setVolume(command.level);
        case 'brightness':
          setBrightness(Math.min(Math.max(command.level, MIN_BRIGHTNESS), 1));
          return true;
      }
    };
    const onCommand = (command: TvCommand) => {
      if (!activeRef.current) {
        socket.emit('tv:applied', { id: command.id, ok: false, detail: 'not watching' });
        return;
      }
      flash(commandLabel(command));
      if (command.type !== 'volume' && command.type !== 'brightness') poke();
      apply(command)
        .then((ok) => socket.emit('tv:applied', { id: command.id, ok }))
        .catch(() => socket.emit('tv:applied', { id: command.id, ok: false }));
    };
    socket.on('tv:command', onCommand);
    return () => {
      socket.off('tv:command', onCommand);
    };
  }, [socket, play, pause, seekBy, setVolume, poke, flash]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      void play();
    } else pause();
    poke();
  };

  const jump = (deltaSec: number) => {
    seekBy(deltaSec);
    flash(deltaSec > 0 ? `+${deltaSec} s` : `−${-deltaSec} s`);
    poke();
  };

  useRemote((key) => {
    if (!activeRef.current) return;
    unmute(); // any key counts as the click a browser wants before it plays sound
    if (report.ended || failed) {
      if (key === 'select' || key === 'back') onHome();
      return;
    }
    if (key === 'select' || key === 'playPause') toggle();
    else if (key === 'left' || key === 'rewind') jump(-SEEK_SEC);
    else if (key === 'right' || key === 'forward') jump(SEEK_SEC);
    else if (key === 'up' || key === 'down') poke();
    else if (key === 'back') onHome();
  });

  // An answer shows for 8 s; Pip shows with it.
  const [answeredId, setAnsweredId] = useState<number | null>(null);
  useEffect(() => {
    if (!say) return;
    const t = setTimeout(
      () => setAnsweredId(say.id),
      say.say.source === 'imagined' ? STORY_MS : ANSWER_MS,
    );
    return () => clearTimeout(t);
  }, [say]);
  const answer = say && say.id !== answeredId ? say : null;

  const { paused, ended } = report;
  const isAsked = view.assistant.open;
  const isPaused = paused && !ended && loaded;
  const isPipShown = isAsked || isPaused || view.pip === 'thinking' || answer !== null;
  const hint = isAsked
    ? 'Ask me on your Pip Pad.'
    : isPaused
      ? 'Paused. Tap Pip on your pad to ask about the film.'
      : null;
  const isChromeShown = active && (chrome || isPaused) && !ended && !failed;
  const duration = report.durationSec || content.durationSec;
  const progress = duration > 0 ? Math.min(1, report.positionSec / duration) : 0;
  const prediction = view.kidsMode ? (view.companion?.prediction ?? null) : null;

  return (
    <div className="player" onMouseMove={active ? poke : undefined}>
      <video
        ref={videoRef}
        className="player-video"
        playsInline
        preload="auto"
        onClick={() => {
          unmute();
          if (!ended && !failed) toggle();
        }}
      />
      {brightness < 1 && <div className="player-dim" style={{ opacity: 1 - brightness }} />}

      {active && (
        <div className="player-overlay">
          <div className={`credit${showCredit ? ' is-shown' : ''}`}>{content.credit}</div>

          {toast && (
            <div key={toast.id} className="toast" role="status">
              {toast.text}
            </div>
          )}

          {soundBlocked && (
            <button type="button" className="sound-chip" onClick={unmute}>
              Sound is off. Press any key or click to turn it on.
            </button>
          )}

          <div className={`chrome${isChromeShown ? ' is-shown' : ''}`} aria-hidden={!isChromeShown}>
            <div className="chrome-top">
              <p className="chrome-title">{content.title}</p>
            </div>
            <div className="chrome-bottom">
              <div className="scrub" aria-hidden="true">
                <span className="scrub-fill" style={{ width: `${progress * 100}%` }} />
                <span className="scrub-knob" style={{ left: `${progress * 100}%` }} />
              </div>
              <div className="chrome-row">
                <span className="time">{clock(report.positionSec)}</span>
                <div className="controls">
                  <button
                    type="button"
                    className="round-button"
                    onClick={() => jump(-SEEK_SEC)}
                    aria-label="Back 10 seconds"
                  >
                    −10
                  </button>
                  <button
                    type="button"
                    className="round-button round-button--primary"
                    onClick={toggle}
                    aria-label={paused ? 'Play' : 'Pause'}
                  >
                    {paused ? <PlayIcon /> : <PauseIcon />}
                  </button>
                  <button
                    type="button"
                    className="round-button"
                    onClick={() => jump(SEEK_SEC)}
                    aria-label="Forward 10 seconds"
                  >
                    +10
                  </button>
                </div>
                <span className="time">−{clock(duration - report.positionSec)}</span>
              </div>
              <p className="chrome-hint">
                <kbd>←</kbd> <kbd>→</kbd> 10 s <span className="dot">·</span> <kbd>OK</kbd> play or
                pause
                <span className="dot">·</span> <kbd>Back</kbd> films
              </p>
            </div>
          </div>

          {(ended || failed) && (
            <div className="end-card">
              <p className="end-title">
                {failed
                  ? "The film didn't load."
                  : view.kidsMode
                    ? 'The end. Ready for the quiz?'
                    : 'The end.'}
              </p>
              <button
                type="button"
                className="tv-button tv-button--primary is-focused"
                onClick={onHome}
              >
                Back to films
              </button>
            </div>
          )}

          {prediction && (
            <div className="prediction">
              <p className="caption">
                {prediction.status === 'open' ? 'What happens next?' : 'And the answer…'}
              </p>
              <p className="prediction-question">{prediction.question}</p>
              <ol className="prediction-choices">
                {prediction.choices.map((choice, i) => (
                  <li
                    key={choice}
                    className={
                      prediction.status === 'revealed'
                        ? i === prediction.answer
                          ? 'is-right'
                          : 'is-dim'
                        : undefined
                    }
                  >
                    {choice}
                  </li>
                ))}
              </ol>
              <p className="caption">
                {prediction.status === 'open'
                  ? `${prediction.votedIds.length} voted on their Pip Pad`
                  : prediction.reveal}
              </p>
            </div>
          )}

          {view.kidsMode && (
            <div className="reactions" aria-hidden="true">
              {reactions.map((r) => (
                <span
                  key={r.id}
                  className={`reaction reaction--lane${r.lane}`}
                  onAnimationEnd={() => onReactionDone(r.id)}
                >
                  {REACTION_FACE[r.kind]}
                </span>
              ))}
            </div>
          )}

          {isPipShown && (
            <div className={`corner${isChromeShown ? ' is-raised' : ''}`}>
              {answer ? (
                <Bubble
                  key={`say-${answer.id}`}
                  above={
                    answer.say.source === 'imagined'
                      ? `${answer.say.askedByName}'s what if, made up by Pip`
                      : `${answer.say.askedByName} asked: ${answer.say.question}`
                  }
                  text={answer.say.text}
                  tone="accent"
                  isStory={answer.say.source === 'imagined'}
                />
              ) : hint && view.pip !== 'thinking' ? (
                <Bubble key={hint} text={hint} />
              ) : null}
              <Pip state={view.pip === 'sleep' ? 'idle' : view.pip} size={96} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function commandLabel(command: TvCommand): string {
  switch (command.type) {
    case 'play':
      return 'Play';
    case 'pause':
      return 'Paused';
    case 'seek':
      return command.deltaSec > 0 ? `+${command.deltaSec} s` : `−${-command.deltaSec} s`;
    case 'volume':
      return `Volume ${Math.round(command.level * 100)}%`;
    case 'brightness':
      return `Brightness ${Math.round(command.level * 100)}%`;
  }
}

function PauseIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    </svg>
  );
}
