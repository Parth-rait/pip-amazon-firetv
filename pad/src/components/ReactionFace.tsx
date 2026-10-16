// The four reaction faces, drawn in Pip's style (a round face, no emoji): laugh, wow, love, scared.
import { REACTIONS } from '../lib/reactions';
import type { ReactionKind } from '../shared/protocol';

const INK = '#0b0b0f';

export function ReactionFace({ kind, size = 40 }: { kind: ReactionKind; size?: number }) {
  const color = REACTIONS.find((r) => r.kind === kind)?.color ?? '#FFD166';
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill={color} />
      {kind === 'laugh' && (
        <>
          <path
            d="M11 17 q3 -4 6 0 M23 17 q3 -4 6 0"
            stroke={INK}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M12 23 q8 9 16 0 z" fill={INK} />
        </>
      )}
      {kind === 'wow' && (
        <>
          <circle cx="14" cy="16" r="2.6" fill={INK} />
          <circle cx="26" cy="16" r="2.6" fill={INK} />
          <ellipse cx="20" cy="27" rx="4" ry="5" fill={INK} />
        </>
      )}
      {kind === 'love' && (
        <>
          <path
            d="M11 17 q3 -4 6 0 M23 17 q3 -4 6 0"
            stroke={INK}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M20 31 l-6 -6 a3.5 3.5 0 0 1 6 -4 a3.5 3.5 0 0 1 6 4 z" fill="#E5384F" />
        </>
      )}
      {kind === 'scared' && (
        <>
          <circle cx="14" cy="16" r="3.4" fill="#fff" stroke={INK} strokeWidth="1.6" />
          <circle cx="26" cy="16" r="3.4" fill="#fff" stroke={INK} strokeWidth="1.6" />
          <circle cx="14" cy="16" r="1.4" fill={INK} />
          <circle cx="26" cy="16" r="1.4" fill={INK} />
          <path
            d="M12 28 q2 -3 4 0 q2 3 4 0 q2 -3 4 0 q2 3 4 0"
            stroke={INK}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
