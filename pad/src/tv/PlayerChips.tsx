// Who is in the room: a colour dot and a name per player, the host marked, offline players dimmed.
import { AVATAR_COLORS, type SessionView } from '../shared/protocol';

export function PlayerChips({
  view,
  lit,
}: {
  view: SessionView;
  lit?: ReadonlySet<string>; // in the quiz: who has answered
}) {
  if (view.players.length === 0) {
    return <p className="caption">Nobody has joined yet</p>;
  }
  return (
    <ul className="chips" aria-label="Players">
      {view.players.map((p) => (
        <li
          key={p.id}
          className={`chip${p.online ? '' : ' is-offline'}${lit?.has(p.id) ? ' is-lit' : ''}`}
        >
          <span
            className="chip-dot"
            style={{ background: AVATAR_COLORS[p.avatar] ?? AVATAR_COLORS[0] }}
          />
          {p.name}
          {p.id === view.hostId && <span className="chip-host">host</span>}
        </li>
      ))}
    </ul>
  );
}
