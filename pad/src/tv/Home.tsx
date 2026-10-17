// HOME (the lobby stage): a Fire TV style launcher. The featured film fills the top with Play or
// Resume; rows of films below; the Pip Pad's QR and code stay in view. The D-pad moves the focus,
// the featured film follows it, and OK starts the film for the whole room (tv:watch).
import { useEffect, useMemo, useState } from 'react';
import { Pip } from '../components/Pip';
import type { ContentView, SessionView } from '../shared/protocol';
import { local } from './net';
import { PlayerChips } from './PlayerChips';
import { useRemote } from './remote';
import { clock, resumeAt, type GreetEntry } from './store';
import { Bubble } from './Bubble';

const GREETING_MS = 4000;
const ROW_STEP = 372; // a row's height and the gap, in tv.css

type Row =
  | { kind: 'hero'; title: null; items: ('play' | 'restart')[] }
  | { kind: 'films'; title: string; items: ContentView[] };

interface Focus {
  row: number;
  col: number;
}

export function Home({
  view,
  films,
  filmsFailed,
  qrUrl,
  greet,
  onWatch,
}: {
  view: SessionView;
  films: ContentView[] | null;
  filmsFailed: boolean;
  qrUrl: string | null;
  greet: GreetEntry | null;
  onWatch: (film: ContentView, fromStart: boolean) => void;
}) {
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>({ row: 0, col: 0 });

  const resumable = useMemo(
    () => (films ?? []).filter((f) => resumeAt(view, f.id) !== null),
    [films, view],
  );
  const featured = films?.find((f) => f.id === featuredId) ?? resumable[0] ?? films?.[0] ?? null;
  const featuredResume = featured ? resumeAt(view, featured.id) : null;

  const heroActions = useMemo<('play' | 'restart')[]>(
    () => (featuredResume !== null ? ['play', 'restart'] : ['play']),
    [featuredResume],
  );
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [
      {
        kind: 'hero',
        title: null,
        items: heroActions,
      },
    ];
    if (resumable.length > 0)
      list.push({ kind: 'films', title: 'Continue watching', items: resumable });
    if (films && films.length > 0) list.push({ kind: 'films', title: 'Films', items: films });
    return list;
  }, [films, resumable, heroActions]);

  // Keep the focus on something that exists when rows come and go.
  const safeRow = Math.min(focus.row, rows.length - 1);
  const safeCol = Math.min(focus.col, (rows[safeRow]?.items.length ?? 1) - 1);

  const moveTo = (row: number, col: number) => {
    const target = rows[row];
    if (!target) return;
    const c = Math.max(0, Math.min(col, target.items.length - 1));
    setFocus({ row, col: c });
    if (target.kind === 'films') setFeaturedId(target.items[c]?.id ?? null);
  };

  const activate = (row: number, col: number) => {
    const target = rows[row];
    if (!target) return;
    if (target.kind === 'hero') {
      if (featured) onWatch(featured, target.items[col] === 'restart');
      return;
    }
    const film = target.items[col];
    if (film) onWatch(film, false);
  };

  useRemote((key) => {
    if (key === 'up') moveTo(safeRow - 1, safeRow - 1 === 0 ? 0 : safeCol);
    else if (key === 'down') moveTo(safeRow + 1, safeRow === 0 ? 0 : safeCol);
    else if (key === 'left') moveTo(safeRow, safeCol - 1);
    else if (key === 'right') moveTo(safeRow, safeCol + 1);
    else if (key === 'select' || key === 'playPause') activate(safeRow, safeCol);
  });

  const [greetedId, setGreetedId] = useState<number | null>(null);
  useEffect(() => {
    if (!greet) return;
    const t = setTimeout(() => setGreetedId(greet.id), GREETING_MS);
    return () => clearTimeout(t);
  }, [greet]);
  const greeting = greet && greet.id !== greetedId ? greet : null;

  const isFocused = (row: number, col: number) => row === safeRow && col === safeCol;

  return (
    <div className="home">
      <div className="hero">
        {featured?.poster && (
          <img key={featured.id} className="hero-art" src={local(featured.poster)} alt="" />
        )}
        <div className="hero-scrim" />
        <header className="topbar">
          <div className="brand">
            <Pip state={view.pip === 'sleep' ? 'idle' : view.pip} size={56} />
            <span>Pip</span>
          </div>
          <Clock />
        </header>

        <div className="hero-copy">
          {featured ? (
            <>
              <p className="eyebrow">
                {featuredResume !== null ? 'Continue watching' : 'Featured film'}
              </p>
              <h1 className="hero-title">{featured.title}</h1>
              <p className="hero-meta">
                {Math.max(1, Math.round(featured.durationSec / 60))} min
                <span className="dot" aria-hidden="true">
                  ·
                </span>
                Open movie
                {featuredResume !== null && (
                  <>
                    <span className="dot" aria-hidden="true">
                      ·
                    </span>
                    {clock(featured.durationSec - featuredResume)} left
                  </>
                )}
              </p>
              <p className="hero-synopsis">{featured.synopsis}</p>
              <div className="hero-actions">
                {heroActions.map((action, col) => (
                  <button
                    key={action}
                    type="button"
                    className={`tv-button${col === 0 ? ' tv-button--primary' : ''}${isFocused(0, col) ? ' is-focused' : ''}`}
                    onMouseEnter={() => moveTo(0, col)}
                    onClick={() => activate(0, col)}
                  >
                    {action === 'restart' ? (
                      <>
                        <RestartIcon /> Start over
                      </>
                    ) : (
                      <>
                        <PlayIcon />
                        {featuredResume !== null ? `Resume from ${clock(featuredResume)}` : 'Play'}
                      </>
                    )}
                  </button>
                ))}
              </div>
              {featuredResume !== null && (
                <div className="hero-progress" aria-hidden="true">
                  <span style={{ width: `${(featuredResume / featured.durationSec) * 100}%` }} />
                </div>
              )}
            </>
          ) : (
            <p className="hero-synopsis">
              {filmsFailed ? "The films didn't load." : 'Loading films…'}
            </p>
          )}
        </div>

        <aside className="pair-card" aria-label="Join with your Pip Pad">
          {qrUrl ? (
            <img className="pair-qr" src={local(qrUrl)} alt="QR code to join" />
          ) : (
            <div className="pair-qr" />
          )}
          <div className="pair-text">
            <p className="caption">Scan for your Pip Pad</p>
            <p className="pair-code">{view.code}</p>
            <PlayerChips view={view} />
          </div>
        </aside>
      </div>

      <div className="rows">
        <div
          className="rows-track"
          style={{ transform: `translateY(${-Math.max(0, safeRow - 1) * ROW_STEP}px)` }}
        >
          {rows.map((row, r) =>
            row.kind === 'films' ? (
              <section key={row.title} className="row">
                <h2 className="row-title">{row.title}</h2>
                <div className="row-items">
                  {row.items.map((film, c) => {
                    const resume = resumeAt(view, film.id);
                    return (
                      <button
                        key={film.id}
                        type="button"
                        className={`card${isFocused(r, c) ? ' is-focused' : ''}`}
                        onMouseEnter={() => moveTo(r, c)}
                        onClick={() => activate(r, c)}
                      >
                        <span className="card-art">
                          {film.poster ? <img src={local(film.poster)} alt="" /> : null}
                          {resume !== null && (
                            <span className="card-progress">
                              <span style={{ width: `${(resume / film.durationSec) * 100}%` }} />
                            </span>
                          )}
                        </span>
                        <span className="card-title">{film.title}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null,
          )}
        </div>
      </div>

      {greeting && (
        <div className="corner">
          <Bubble key={greeting.id} text={greeting.hello.text} tone="accent" />
          <Pip state="talking" size={96} />
        </div>
      )}
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="topbar-clock">
      {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </span>
  );
}

export function PlayIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
