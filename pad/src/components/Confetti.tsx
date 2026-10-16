// A short confetti burst for a right answer: CSS only, spread from each piece's index (no randomness
// during render), and nothing at all with prefers-reduced-motion.
import type { CSSProperties } from 'react';
import { AVATAR_COLORS } from '../shared/protocol';

const PIECES = 28;

export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => {
        const style = {
          '--x': `${((i * 37) % 100) - 50}vw`,
          '--spin': `${(i * 83) % 720}deg`,
          '--delay': `${(i % 7) * 40}ms`,
          background: AVATAR_COLORS[i % AVATAR_COLORS.length],
        } as CSSProperties;
        return <span key={i} className="confetti__piece" style={style} />;
      })}
    </div>
  );
}
