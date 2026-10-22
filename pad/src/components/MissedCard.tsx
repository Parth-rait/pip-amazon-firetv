// "While you were away": what this viewer missed, on their pad only, from Pip's reviewed facts
// up to now. The film and everyone else carry on; the card waits until it is closed.
import type { PipMissed } from '../shared/protocol';
import { formatClock } from '../lib/format';
import { Pip } from './Pip';

interface Props {
  missed: PipMissed;
  onDone: () => void;
}

export function MissedCard({ missed, onDone }: Props) {
  const gap = Math.max(0, missed.toSec - missed.fromSec);
  const minutes = Math.max(1, Math.round(gap / 60));
  return (
    <section className="missed" aria-label="While you were away">
      <header className="missed__head">
        <Pip state="talking" size={40} />
        <div>
          <h2 className="title">{missed.lateJoin ? 'The story so far' : 'While you were away'}</h2>
          <p className="caption">
            {missed.lateJoin
              ? `You joined at ${formatClock(missed.toSec)}. No spoilers past now.`
              : `About ${minutes} min, ${formatClock(missed.fromSec)} to ${formatClock(missed.toSec)}.`}
          </p>
        </div>
      </header>
      <ol className="missed__list">
        {missed.items.map((item) => (
          <li key={item.atSec} className="missed__item">
            <span className="missed__time">{formatClock(item.atSec)}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ol>
      <button className="button button--wide" onClick={onDone}>
        Got it
      </button>
    </section>
  );
}
