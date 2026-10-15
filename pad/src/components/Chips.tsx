// The guidance chips (sections 3.3 and 5.4): starters, then my next questions, or "Did you mean".
import type { AskVia } from '../shared/protocol';
import type { ChipKind } from '../state/store';

const VIA_FOR: Record<ChipKind, AskVia> = { starter: 'starter', next: 'next', clarify: 'clarify' };

interface Props {
  kind: ChipKind;
  items: string[];
  isDisabled: boolean;
  onAsk: (text: string, via: AskVia) => void;
  onSomethingElse: () => void;
}

export function Chips({ kind, items, isDisabled, onAsk, onSomethingElse }: Props) {
  if (kind === 'clarify') {
    return (
      <section className="clarify" aria-label="Did you mean">
        <p className="caption">Did you mean one of these?</p>
        {items.map((item) => (
          <button
            key={item}
            className="button button--wide"
            disabled={isDisabled}
            onClick={() => onAsk(item, 'clarify')}
          >
            {item}
          </button>
        ))}
        <button className="button button--wide button--quiet" onClick={onSomethingElse}>
          Something else
        </button>
      </section>
    );
  }
  return (
    <div className="chips" aria-label="Suggested questions">
      {items.map((item) => (
        <button
          key={item}
          className="chip"
          disabled={isDisabled}
          onClick={() => onAsk(item, VIA_FOR[kind])}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
