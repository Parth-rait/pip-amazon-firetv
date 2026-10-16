// A player's avatar: a little Pip in the color they picked, with its own ears (PROJECT.md 2.4).
// Each of the 8 colors has a different shape on top, so children can find themselves at a glance.
import { AVATAR_COLORS } from '../shared/protocol';

const INK = '#0b0b0f';

function Top({ variant, fill }: { variant: number; fill: string }) {
  switch (variant) {
    case 1: // bear
      return (
        <>
          <circle cx="9" cy="11" r="5" fill={fill} />
          <circle cx="31" cy="11" r="5" fill={fill} />
        </>
      );
    case 2: // cat
      return <path d="M7 16 L10 3 L18 10 Z M33 16 L30 3 L22 10 Z" fill={fill} />;
    case 3: // bunny
      return (
        <>
          <ellipse cx="14" cy="7" rx="3.2" ry="8" fill={fill} />
          <ellipse cx="26" cy="7" rx="3.2" ry="8" fill={fill} />
        </>
      );
    case 4: // antenna
      return (
        <>
          <path d="M20 8 V2.5" stroke={fill} strokeWidth="2" strokeLinecap="round" />
          <circle cx="20" cy="2.8" r="2.6" fill={fill} />
        </>
      );
    case 5: // sprout
      return (
        <path
          d="M20 8 C20 3 24 1 28 2 C27 6 24 8 20 8 Z M20 8 C19 4 16 3 13 4 C14 7 17 8 20 8 Z"
          fill={fill}
        />
      );
    case 6: // tuft
      return (
        <path
          d="M17 8 L16 2 M20 8 V1 M23 8 L24 2"
          stroke={fill}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      );
    case 7: // crown
      return <path d="M11 10 L13 3 L17 8 L20 2 L23 8 L27 3 L29 10 Z" fill={fill} />;
    default: // plain, like Pip
      return null;
  }
}

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
  return (
    <svg
      className={isAway ? 'avatar avatar--away' : 'avatar'}
      viewBox="0 0 40 40"
      width={size}
      height={size}
      role="img"
      aria-label={name}
    >
      <Top variant={avatar} fill={fill} />
      <circle cx="20" cy="23" r="15" fill={fill} />
      <ellipse cx="15" cy="22" rx="2.1" ry="3.2" fill={INK} />
      <ellipse cx="25" cy="22" rx="2.1" ry="3.2" fill={INK} />
    </svg>
  );
}
