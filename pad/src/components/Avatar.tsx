// A player's avatar: their initial on the color they picked, like a contact photo (section 2.4).
import { initialOf } from '../lib/format';
import { AVATAR_COLORS } from '../shared/protocol';

export function Avatar({
  name,
  avatar,
  size = 40,
  isAway = false,
}: {
  name: string;
  avatar: number;
  size?: number;
  isAway?: boolean;
}) {
  return (
    <span
      className={isAway ? 'avatar avatar--away' : 'avatar'}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.44,
        background: AVATAR_COLORS[avatar] ?? AVATAR_COLORS[0],
      }}
      aria-hidden="true"
    >
      {initialOf(name)}
    </span>
  );
}
