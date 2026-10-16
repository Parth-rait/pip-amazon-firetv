// LOBBY: the host picks a film and can turn on kids games; everyone else waits. Quizzes, guesses
// and reactions are an opt-in skill, never the default (docs/vnext/PLAN.md 3.1).
import { useEffect, useState } from 'react';
import { PlayerList } from '../components/PlayerList';
import { Pip } from '../components/Pip';
import { formatMinutes } from '../lib/format';
import type { ContentView, HostCommand, SessionView } from '../shared/protocol';
import { hostName } from '../state/store';

interface Props {
  view: SessionView;
  myId: string;
  isHost: boolean;
  onCommand: (command: HostCommand) => void;
}

export function LobbyScreen({ view, myId, isHost, onCommand }: Props) {
  const [films, setFilms] = useState<ContentView[] | null>(null);
  const [isLoadFailed, setIsLoadFailed] = useState(false);

  useEffect(() => {
    if (!isHost) return;
    fetch('/api/films')
      .then((res) =>
        res.ok
          ? (res.json() as Promise<ContentView[]>)
          : Promise.reject(new Error(String(res.status))),
      )
      .then(setFilms)
      .catch(() => setIsLoadFailed(true));
  }, [isHost]);

  return (
    <main className="screen">
      {isHost ? (
        <>
          <h1 className="large-title">Pick a film</h1>
          {isLoadFailed && (
            <p className="error">The films didn't load. Reload the page to try again.</p>
          )}
          <div className="film-list">
            {films?.map((film) => (
              <button
                key={film.id}
                className="poster-card"
                onClick={() => onCommand({ type: 'watch', contentId: film.id })}
              >
                {film.poster ? (
                  <img className="poster-card__image" src={film.poster} alt="" />
                ) : (
                  <span className="poster-card__image" />
                )}
                <span className="poster-card__text">
                  <span className="poster-card__title">{film.title}</span>
                  <span className="caption">{formatMinutes(film.durationSec)}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            className="row-button"
            role="switch"
            aria-checked={view.kidsMode}
            onClick={() => onCommand({ type: 'kids-mode', on: !view.kidsMode })}
          >
            <span className="row-button__text">
              <span>Kids games</span>
              <span className="caption">
                {view.kidsMode
                  ? 'On: a quiz after the film, guesses and reactions.'
                  : 'Off: just the film, with Pip when you ask.'}
              </span>
            </span>
            <span className={view.kidsMode ? 'switch is-on' : 'switch'} aria-hidden="true" />
          </button>
        </>
      ) : (
        <section className="waiting">
          <Pip state={view.pip} size={96} />
          <h1 className="title">Waiting for {hostName(view) ?? 'the host'} to pick a film</h1>
        </section>
      )}
      <section className="stack">
        <p className="label">Here now</p>
        <PlayerList view={view} myId={myId} />
      </section>
    </main>
  );
}
