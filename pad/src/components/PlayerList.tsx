// Everyone in the session, in join order, with "you" and "host" marked and offline players dimmed.
import type { SessionView } from '../shared/protocol';

export function PlayerList({ view, myId }: { view: SessionView; myId: string }) {
  return (
    <ul className="players" aria-label="Players">
      {view.players.map((player) => {
        const marks = [player.id === myId && 'you', player.id === view.hostId && 'host'].filter(
          Boolean,
        );
        return (
          <li key={player.id} className={player.online ? 'player' : 'player player--away'}>
            {player.name}
            {marks.length > 0 && <span className="player__marks"> ({marks.join(', ')})</span>}
          </li>
        );
      })}
    </ul>
  );
}
