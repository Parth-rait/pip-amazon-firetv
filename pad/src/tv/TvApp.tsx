// The browser TV (/tv): a second TV client beside the Vega app, on the same protocol, so the
// whole room (pads, gestures, Pip) can be built and shown on a laptop. A 1920 x 1080 canvas is
// scaled to the window, as the Vega app scales its 1080p layout to the screen. The server owns
// the stage; this draws whatever session:view says (PROJECT.md 3.3).
import { useEffect, useMemo, useReducer, useState } from 'react';
import { Pip } from '../components/Pip';
import type { ContentView } from '../shared/protocol';
import { Home } from './Home';
import { Quiz, Results } from './KidsScreens';
import { createTvSocket, sendHello } from './net';
import { Player } from './Player';
import { initialTvState, tvReducer } from './store';

const CANVAS = { width: 1920, height: 1080 };

export function TvApp() {
  const socket = useMemo(() => createTvSocket(), []);
  const [state, dispatch] = useReducer(tvReducer, initialTvState);
  // "Start over" is the TV's own choice: the server resumes a film where it was.
  const [fromStartId, setFromStartId] = useState<string | null>(null);
  const stage = useStageScale();

  useEffect(() => {
    const onConnect = () => {
      dispatch({ type: 'connected' });
      sendHello(socket, (r) =>
        dispatch({ type: 'hello', code: r.code, padUrl: r.padUrl, qrUrl: r.qrUrl }),
      );
    };
    const onDisconnect = () => dispatch({ type: 'disconnected' });
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session:view', (view) => {
      dispatch({ type: 'view', view });
      if (view.stage === 'lobby') setFromStartId(null); // Start over applies to one viewing
    });
    socket.on('pip:say', (say) => dispatch({ type: 'say', say }));
    socket.on('pip:hello', (hello) => dispatch({ type: 'greet', hello }));
    socket.on('pip:react', (r) => dispatch({ type: 'react', kind: r.kind }));
    if (socket.connected) onConnect();
    else socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session:view');
      socket.off('pip:say');
      socket.off('pip:hello');
      socket.off('pip:react');
      socket.disconnect();
    };
  }, [socket]);

  // The films, once per connection until they load.
  const { connected, filmsFailed } = state;
  const hasFilms = state.films !== null;
  useEffect(() => {
    if (!connected || hasFilms) return;
    let cancelled = false;
    fetch('/api/films')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ContentView[]>;
      })
      .then((films) => !cancelled && dispatch({ type: 'films', films }))
      .catch(() => !cancelled && dispatch({ type: 'films-failed' }));
    return () => {
      cancelled = true;
    };
  }, [connected, hasFilms, filmsFailed]);

  // F toggles full screen, as a TV would be.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'f' && event.key !== 'F') return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { view } = state;

  const watch = (film: ContentView, fromStart: boolean) => {
    if (!socket.connected) return;
    setFromStartId(fromStart ? film.id : null);
    socket.emit('tv:watch', { contentId: film.id });
  };

  let screen;
  if (!view) {
    screen = (
      <div className="boot">
        <Pip state="sleep" size={160} />
        <p className="boot-line">{state.connected ? 'Getting a code…' : 'Connecting to Pip…'}</p>
      </div>
    );
  } else if (view.stage === 'lobby' || !view.content) {
    screen = (
      <Home
        view={view}
        films={state.films}
        filmsFailed={state.filmsFailed}
        qrUrl={state.hello?.qrUrl ?? null}
        greet={state.greet}
        onWatch={watch}
      />
    );
  } else {
    screen = (
      <>
        <Player
          key={view.content.id}
          socket={socket}
          view={view}
          content={view.content}
          say={state.say}
          reactions={state.reactions}
          fromStart={fromStartId === view.content.id}
          onHome={() => socket.emit('tv:home')}
          onReactionDone={(id) => dispatch({ type: 'reaction-done', id })}
        />
        {view.stage === 'quiz' && view.quiz && <Quiz view={view} quiz={view.quiz} />}
        {view.stage === 'results' && view.results && <Results view={view} results={view.results} />}
      </>
    );
  }

  return (
    <div className="tv-viewport">
      <div
        className="tv-stage"
        style={{ transform: `scale(${stage.scale})`, left: stage.left, top: stage.top }}
      >
        {screen}
        {view && !state.connected && (
          <div className="status-pill" role="status">
            Reconnecting…
          </div>
        )}
      </div>
    </div>
  );
}

/** The scale and offsets that fit the 1920 x 1080 canvas in the window, letterboxed. */
function useStageScale() {
  const measure = () => {
    const scale = Math.min(window.innerWidth / CANVAS.width, window.innerHeight / CANVAS.height);
    return {
      scale,
      left: (window.innerWidth - CANVAS.width * scale) / 2,
      top: (window.innerHeight - CANVAS.height * scale) / 2,
    };
  };
  const [stage, setStage] = useState(measure);
  useEffect(() => {
    const onResize = () => setStage(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return stage;
}
