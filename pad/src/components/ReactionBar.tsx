// The reaction bar on the watch screen: a tap sends a face that floats up on the TV.
import { useRef, useState } from 'react';
import { vibrateTap } from '../lib/haptics';
import type { ReactionKind } from '../shared/protocol';
import { REACTIONS } from '../lib/reactions';
import { ReactionFace } from './ReactionFace';

interface Pop {
  id: number;
  kind: ReactionKind;
}

export function ReactionBar({
  isRaised,
  onReact,
}: {
  isRaised: boolean; // sits above the Ask bar on the Pip tab
  onReact: (kind: ReactionKind) => void;
}) {
  const [pops, setPops] = useState<Pop[]>([]);
  const nextId = useRef(0);

  const react = (kind: ReactionKind) => {
    onReact(kind);
    vibrateTap();
    nextId.current += 1;
    const id = nextId.current;
    setPops((all) => [...all.slice(-5), { id, kind }]);
    setTimeout(() => setPops((all) => all.filter((p) => p.id !== id)), 900);
  };

  return (
    <div className={isRaised ? 'reactions reactions--raised' : 'reactions'} aria-label="React">
      {REACTIONS.map(({ kind, label }) => (
        <button key={kind} className="reaction" onClick={() => react(kind)} aria-label={label}>
          <ReactionFace kind={kind} size={40} />
          {pops
            .filter((p) => p.kind === kind)
            .map((p) => (
              <span key={p.id} className="reaction__pop" aria-hidden="true">
                <ReactionFace kind={kind} size={28} />
              </span>
            ))}
        </button>
      ))}
    </div>
  );
}
