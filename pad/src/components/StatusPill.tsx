// The connection pill: Online, Reconnecting, Looking for your TV, or TV offline with a way out.
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
  return <span className="pill">Online</span>;
}
