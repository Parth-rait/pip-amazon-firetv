// LOBBY on the TV: Pip, the QR code and the code, the players, and film cards the remote can start.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Pip } from '../components/Pip';
import type { ContentView, SessionView } from '../shared/protocol';
import type { Pairing, TvSocket } from './TvApp';

interface Props {
  socket: TvSocket;
  view: SessionView | null;
  pairing: Pairing | null;
}

export function TvLobby({ socket, view, pairing }: Props) {
  const [films, setFilms] = useState<ContentView[]>([]);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    fetch('/api/films')
      .then((res) => (res.ok ? (res.json() as Promise<ContentView[]>) : []))
      .then(setFilms)
      .catch(() => setFilms([]));
  }, []);

  // The remote's up and down move between films; OK (Enter) starts one.
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    cards.current[(index + step + films.length) % films.length]?.focus();
  };

  const players = view?.players ?? [];
  const anyoneHere = players.some((p) => p.online);

  return (
    <main className="tv-lobby">
      <section className="tv-lobby__join">
        <Pip state={view?.pip ?? 'sleep'} size={140} />
        {pairing ? (
          <>
            <div className="tv-qr">
              <img src={pairing.qrUrl} alt="QR code to join on your phone" />
            </div>
            <p className="tv-caption">Scan to join, or enter</p>
            <p className="tv-code" aria-label={`Code ${pairing.code.split('').join(' ')}`}>
              {pairing.code}
            </p>
          </>
        ) : (
          <p className="tv-caption">Starting…</p>
        )}
      </section>

      <section className="tv-lobby__side">
        <h1 className="tv-title">{anyoneHere ? 'Pick a film' : 'Join with your phone'}</h1>
        <div className="tv-films">
          {films.map((film, index) => (
            <button
              key={film.id}
              ref={(el) => {
                cards.current[index] = el;
              }}
              className="tv-film"
              autoFocus={index === 0}
              onKeyDown={(e) => move(e, index)}
              onClick={() => socket.emit('tv:watch', { contentId: film.id })}
            >
              <span>{film.title}</span>
              <span className="tv-film__time">
                {Math.max(1, Math.round(film.durationSec / 60))} min
              </span>
            </button>
          ))}
        </div>
        <ul className="tv-players" aria-label="Players">
          {players.map((p) => (
            <li key={p.id} className={p.online ? 'tv-player' : 'tv-player tv-player--away'}>
              {p.name}
              {p.id === view?.hostId && <span className="tv-player__mark"> host</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
