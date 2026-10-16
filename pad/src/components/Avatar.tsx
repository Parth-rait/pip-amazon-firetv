// A player's mark: their color and first letter, so names are easy to tell apart.
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
  const fill = AVATAR_COLORS[avatar] ?? AVATAR_COLORS[0];
  const letter = [...name.trim()][0]?.toUpperCase() ?? '?';
  return (
    <svg
      className={isAway ? 'avatar avatar--away' : 'avatar'}
      viewBox="0 0 40 40"
      width={size}
      height={size}
      role="img"
      aria-label={name}
    >
      <circle cx="20" cy="20" r="19" fill={fill} />
      <text x="20" y="26.5" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0b0b0f">
        {letter}
      </text>
    </svg>
  );
}
