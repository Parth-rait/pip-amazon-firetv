// LOBBY: the host picks a film and can make Pip theirs; everyone else waits (sections 3.3 and 2.4).
import { useEffect, useState } from 'react';
import { PlayerList } from '../components/PlayerList';
import { Pip } from '../components/Pip';
import { PipStyleSheet } from '../components/PipStyleSheet';
import { SparkleIcon } from '../components/Icons';
import { formatMinutes } from '../lib/format';
import type { ContentView, HostCommand, SessionView } from '../shared/protocol';
import { hostName } from '../state/store';

const MOOD_LABEL = { chill: 'Chill', playful: 'Playful', sassy: 'Sassy' } as const;

interface Props {
  view: SessionView;
  myId: string;
  isHost: boolean;
  onCommand: (command: HostCommand) => void;
}

export function LobbyScreen({ view, myId, isHost, onCommand }: Props) {
  const [films, setFilms] = useState<ContentView[] | null>(null);
  const [isLoadFailed, setIsLoadFailed] = useState(false);
  const [isStyling, setIsStyling] = useState(false);

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
          <button className="row-button" onClick={() => setIsStyling(true)}>
            <Pip state="idle" size={32} />
            <span className="row-button__text">
              <span>Make Pip yours</span>
              <span className="caption">{MOOD_LABEL[view.pipStyle.mood]} mood. Tap to change.</span>
            </span>
            <SparkleIcon />
          </button>
        </>
      ) : (
        <section className="waiting">
          <Pip state={view.pip} size={96} />
          <h1 className="title">Waiting for {hostName(view) ?? 'the host'} to pick a film</h1>
          <p className="caption">
            Pip is in a {MOOD_LABEL[view.pipStyle.mood].toLowerCase()} mood.
          </p>
        </section>
      )}
      <section className="stack">
        <p className="label">Here now</p>
        <PlayerList view={view} myId={myId} />
      </section>
      {isStyling && (
        <PipStyleSheet
          style={view.pipStyle}
          onCommand={onCommand}
          onClose={() => setIsStyling(false)}
        />
      )}
    </main>
  );
}
