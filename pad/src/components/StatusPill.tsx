// The connection pill. It shows only when something is wrong: Reconnecting, Looking for your TV,
// or TV offline with a way out. When all is well the top bar stays quiet.
import type { Connection } from '../state/store';

interface Props {
  connection: Connection;
  tvOnline: boolean;
  isLookingForTv: boolean;
  onJoinAnother: () => void;
}

export function StatusPill({ connection, tvOnline, isLookingForTv, onJoinAnother }: Props) {
  if (connection !== 'online') return <span className="pill pill--muted">Reconnecting</span>;
  if (isLookingForTv) return <span className="pill pill--muted">Looking for your TV</span>;
  if (!tvOnline) {
    return (
      <span className="pill-row">
        <span className="pill pill--muted">TV offline</span>
        <button className="button button--small" onClick={onJoinAnother}>
          Join another TV
        </button>
      </span>
    );
  }
  return null;
}
