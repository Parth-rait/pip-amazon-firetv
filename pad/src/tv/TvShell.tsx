// The TV's launcher: one top bar (Home, Discover, My Space, Scenes, Search) over the page it
// opens. The D-pad moves within the page; Up from the page's first row reaches the bar, Down goes
// back. Pip stays out of the way here too: a greeting in the corner when someone joins, no more.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pip } from '../components/Pip';
import type { ContentView, SceneView, SessionView } from '../shared/protocol';
import { Bubble } from './Bubble';
import { Home, PlayIcon } from './Home';
import { local } from './net';
import { PlayerChips } from './PlayerChips';
import { useRemote } from './remote';
import { clock, resumeAt, type GreetEntry } from './store';

const GREETING_MS = 4000;
const SHORT_SEC = 13 * 60;

export type WatchRequest = (film: ContentView, fromStart: boolean, startAt?: number) => void;

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'discover', label: 'Discover' },
  { id: 'space', label: 'My Space' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'search', label: 'Search' },
] as const;
type Tab = (typeof TABS)[number]['id'];

interface ShellProps {
  view: SessionView;
  films: ContentView[] | null;
  filmsFailed: boolean;
  qrUrl: string | null;
  greet: GreetEntry | null;
  onWatch: WatchRequest;
}

export function TvShell(props: ShellProps) {
  const [tab, setTab] = useState<Tab>('home');
  const [zone, setZone] = useState<'nav' | 'page'>('page');
  const index = TABS.findIndex((t) => t.id === tab);
  const toPage = () => setZone('page');
  const toNav = () => setZone('nav');

  useRemote((key, event) => {
    if (zone !== 'nav') return;
    // The page under the bar listens too: this key is the bar's, not the page's first move.
    event.stopImmediatePropagation();
    if (key === 'left') setTab(TABS[Math.max(0, index - 1)]?.id ?? tab);
    else if (key === 'right') setTab(TABS[Math.min(TABS.length - 1, index + 1)]?.id ?? tab);
    else if (key === 'down' || key === 'select') toPage();
  });

  const [greetedId, setGreetedId] = useState<number | null>(null);
  useEffect(() => {
    if (!props.greet) return;
    const t = setTimeout(() => setGreetedId(props.greet?.id ?? null), GREETING_MS);
    return () => clearTimeout(t);
  }, [props.greet]);
  const greeting = props.greet && props.greet.id !== greetedId ? props.greet : null;

  const page = { ...props, isActive: zone === 'page', onExitUp: toNav };
  return (
    <div className="home">
      {tab === 'home' && <Home {...page} />}
      {tab === 'discover' && <Discover {...page} />}
      {tab === 'space' && <MySpace {...page} />}
      {tab === 'scenes' && <Scenes {...page} />}
      {tab === 'search' && <Search {...page} />}

      <header className="topbar">
        <div className="brand">
          <Pip state={props.view.pip === 'sleep' ? 'idle' : props.view.pip} size={56} />
          <span>Pip</span>
        </div>
        <nav className={`tabs${zone === 'nav' ? ' is-active' : ''}`} aria-label="Pip">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab${t.id === tab ? ' is-current' : ''}${zone === 'nav' && t.id === tab ? ' is-focused' : ''}`}
              onClick={() => {
                setTab(t.id);
                toPage();
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <Clock />
      </header>

      {greeting && (
        <div className="corner">
          <Bubble key={greeting.id} text={greeting.hello.text} tone="accent" />
          <Pip state="talking" size={96} />
        </div>
      )}
    </div>
  );
}

interface PageProps extends ShellProps {
  isActive: boolean;
  onExitUp: () => void;
}

/** A row of focusable items, moved with Left and Right; Up and Down handled by the page. */
function useGridFocus(rows: number[]) {
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const row = Math.min(focus.row, Math.max(0, rows.length - 1));
  const col = Math.min(focus.col, Math.max(0, (rows[row] ?? 1) - 1));
  return {
    row,
    col,
    move: (dr: number, dc: number) =>
      setFocus({
        row: Math.max(0, Math.min(rows.length - 1, row + dr)),
        col: dr !== 0 ? 0 : Math.max(0, Math.min((rows[row] ?? 1) - 1, col + dc)),
      }),
    is: (r: number, c: number) => r === row && c === col,
  };
}

function FilmCard({
  film,
  view,
  isFocused,
  onClick,
  wide = false,
}: {
  film: ContentView;
  view: SessionView;
  isFocused: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  const resume = resumeAt(view, film.id);
  return (
    <button
      type="button"
      className={`card${wide ? ' card--wide' : ''}${isFocused ? ' is-focused' : ''}`}
      onClick={onClick}
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
      {wide && (
        <>
          <span className="card-meta">
            {Math.max(1, Math.round(film.durationSec / 60))} min
            {film.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </span>
          <span className="card-synopsis">{film.synopsis}</span>
        </>
      )}
    </button>
  );
}

/** Discover: pick by kind and mood, from what each film says it is. No profile behind it. */
function Discover({ view, films, isActive, onExitUp, onWatch }: PageProps) {
  const all = useMemo(() => films ?? [], [films]);
  const filters = useMemo(() => {
    const tags = [...new Set(all.flatMap((f) => f.tags))];
    return ['All', `Under ${SHORT_SEC / 60} min`, ...tags];
  }, [all]);
  const [filter, setFilter] = useState('All');
  const shown = all.filter((f) =>
    filter === 'All'
      ? true
      : filter.startsWith('Under')
        ? f.durationSec <= SHORT_SEC
        : f.tags.includes(filter),
  );
  const grid = useGridFocus([filters.length, shown.length]);
  useRemote((key) => {
    if (!isActive) return;
    if (key === 'up') return grid.row === 0 ? onExitUp() : grid.move(-1, 0);
    if (key === 'down') return grid.move(1, 0);
    if (key === 'left') return grid.move(0, -1);
    if (key === 'right') return grid.move(0, 1);
    if (key === 'select') {
      if (grid.row === 0) setFilter(filters[grid.col] ?? 'All');
      else {
        const film = shown[grid.col];
        if (film) onWatch(film, false);
      }
    }
  });
  return (
    <section className="page">
      <h1 className="page-title">Discover</h1>
      <p className="caption">
        What are you in the mood for? Pick a kind of film; Pip doesn't guess it for you.
      </p>
      <div className="chips-row">
        {filters.map((f, c) => (
          <button
            key={f}
            type="button"
            className={`tv-chip${f === filter ? ' is-on' : ''}${isActive && grid.is(0, c) ? ' is-focused' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid-row">
        {shown.map((film, c) => (
          <FilmCard
            key={film.id}
            film={film}
            view={view}
            wide
            isFocused={isActive && grid.is(1, c)}
            onClick={() => onWatch(film, false)}
          />
        ))}
        {shown.length === 0 && <p className="caption">No film fits that yet.</p>}
      </div>
    </section>
  );
}

/** My Space: what this TV remembers for the room, and nothing it keeps about anyone. */
function MySpace({ view, films, qrUrl, isActive, onExitUp, onWatch }: PageProps) {
  const resumable = (films ?? []).filter((f) => resumeAt(view, f.id) !== null);
  const grid = useGridFocus([resumable.length]);
  useRemote((key) => {
    if (!isActive) return;
    if (key === 'up') return onExitUp();
    if (key === 'left') return grid.move(0, -1);
    if (key === 'right') return grid.move(0, 1);
    if (key === 'select') {
      const film = resumable[grid.col];
      if (film) onWatch(film, false);
    }
  });
  return (
    <section className="page page--space">
      <h1 className="page-title">My Space</h1>
      <div className="space-grid">
        <div>
          <h2 className="row-title">Continue watching</h2>
          <div className="row-items">
            {resumable.map((film, c) => (
              <FilmCard
                key={film.id}
                film={film}
                view={view}
                isFocused={isActive && grid.is(0, c)}
                onClick={() => onWatch(film, false)}
              />
            ))}
            {resumable.length === 0 && (
              <p className="caption">
                Nothing half-watched. Start a film and it waits for you here.
              </p>
            )}
          </div>
        </div>
        <aside className="panel">
          <h2 className="row-title">In the room</h2>
          <div className="space-pair">
            {qrUrl ? (
              <img className="pair-qr pair-qr--small" src={local(qrUrl)} alt="QR code to join" />
            ) : null}
            <div>
              <p className="pair-code">{view.code}</p>
              <PlayerChips view={view} />
            </div>
          </div>
          <h2 className="row-title">What Pip keeps</h2>
          <p className="caption">
            First names for this evening only, and where the film is. No accounts, no voice
            recordings, no camera images. Everything stays on this machine.
          </p>
        </aside>
      </div>
    </section>
  );
}

/** Scenes: the chapters already watched, to jump back to. Nothing past where the family is. */
function Scenes({ view, films, isActive, onExitUp, onWatch }: PageProps) {
  const film = (films ?? []).find((f) => f.id === view.playback?.contentId) ?? null;
  const until = film
    ? view.playback?.ended
      ? film.durationSec
      : (resumeAt(view, film.id) ?? 0)
    : 0;
  const [scenes, setScenes] = useState<SceneView[] | null>(null);
  useEffect(() => {
    if (!film) return;
    let cancelled = false;
    fetch(`/api/films/${film.id}/scenes?until=${Math.floor(until)}`)
      .then((res) => (res.ok ? (res.json() as Promise<SceneView[]>) : []))
      .then((list) => !cancelled && setScenes(list))
      .catch(() => !cancelled && setScenes([]));
    return () => {
      cancelled = true;
    };
  }, [film, until]);
  const list = film ? (scenes ?? []) : [];
  const grid = useGridFocus([list.length]);
  useRemote((key) => {
    if (!isActive) return;
    if (key === 'up') return onExitUp();
    if (key === 'left') return grid.move(0, -1);
    if (key === 'right') return grid.move(0, 1);
    if (key === 'select') {
      const scene = list[grid.col];
      if (film && scene) onWatch(film, false, scene.startSec);
    }
  });
  return (
    <section className="page">
      <h1 className="page-title">Scenes</h1>
      <p className="caption">
        {film
          ? `${film.title}: the parts you have watched. Nothing after ${clock(until)}.`
          : 'Scenes appear here as you watch, and only the ones you have seen.'}
      </p>
      <div className="grid-row grid-row--scenes">
        {list.map((scene, c) => (
          <button
            key={scene.atSec}
            type="button"
            className={`card card--scene${isActive && grid.is(0, c) ? ' is-focused' : ''}`}
            onClick={() => film && onWatch(film, false, scene.startSec)}
          >
            <span className="card-art">
              {scene.image ? <img src={local(scene.image)} alt="" /> : null}
            </span>
            <span className="card-title">
              {clock(scene.startSec)} · {scene.title}
            </span>
            <span className="card-synopsis">{scene.summary}</span>
          </button>
        ))}
        {film && scenes !== null && list.length === 0 && (
          <p className="caption">Keep watching: the first scene appears once it is over.</p>
        )}
      </div>
    </section>
  );
}

/** Search: films by title, kind and story, typed with a keyboard (the Pip Pad's keyboard later). */
function Search({ view, films, isActive, onExitUp, onWatch }: PageProps) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [inResults, setInResults] = useState(false);
  const q = query.trim().toLowerCase();
  const results = (films ?? []).filter(
    (f) =>
      q.length === 0 ||
      [f.title, f.synopsis, ...f.tags].some((text) => text.toLowerCase().includes(q)),
  );
  const grid = useGridFocus([results.length]);
  useEffect(() => {
    if (isActive && !inResults) input.current?.focus();
    if (!isActive) input.current?.blur();
  }, [isActive, inResults]);
  useRemote((key) => {
    if (!isActive || !inResults) return;
    if (key === 'up') return setInResults(false);
    if (key === 'left') return grid.move(0, -1);
    if (key === 'right') return grid.move(0, 1);
    if (key === 'select') {
      const film = results[grid.col];
      if (film) onWatch(film, false);
    }
  });
  return (
    <section className="page">
      <h1 className="page-title">Search</h1>
      <input
        ref={input}
        className={`search-box${isActive && !inResults ? ' is-focused' : ''}`}
        value={query}
        placeholder="Title, kind or story: robots, dragons…"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && results.length > 0) {
            e.preventDefault();
            input.current?.blur();
            setInResults(true);
          } else if (e.key === 'ArrowUp' || e.key === 'Escape') {
            e.preventDefault();
            input.current?.blur();
            onExitUp();
          }
        }}
      />
      <div className="grid-row">
        {results.map((film, c) => (
          <FilmCard
            key={film.id}
            film={film}
            view={view}
            wide
            isFocused={isActive && inResults && grid.is(0, c)}
            onClick={() => onWatch(film, false)}
          />
        ))}
        {results.length === 0 && <p className="caption">Nothing matches “{query}”.</p>}
      </div>
      {results.length > 0 && !inResults && isActive && (
        <p className="caption hint-line">
          <PlayIcon /> Press Down to pick a result
        </p>
      )}
    </section>
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
