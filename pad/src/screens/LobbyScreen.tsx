// LOBBY: the host picks a film; everyone else waits (PROJECT.md section 3.3).
import { useEffect, useState } from 'react';
import { PlayerList } from '../components/PlayerList';
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
        <section className="stack">
          <h1 className="title">Pick a film</h1>
          {isLoadFailed && (
            <p className="error">The films didn't load. Reload the page to try again.</p>
          )}
          {films?.map((film) => (
            <button
              key={film.id}
              className="film-card"
              onClick={() => onCommand({ type: 'watch', contentId: film.id })}
            >
              <span className="film-card__title">{film.title}</span>
              <span className="caption">{formatMinutes(film.durationSec)}</span>
            </button>
          ))}
        </section>
      ) : (
        <h1 className="title">Waiting for {hostName(view) ?? 'the host'} to pick a film</h1>
      )}
      <PlayerList view={view} myId={myId} />
    </main>
  );
}
