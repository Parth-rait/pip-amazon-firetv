// Pip on the pad: one round button, and a sheet that opens from it with Pip, its last answer, three
// quick questions and the Ask bar. Opening shows Pip on the TV; closing hides it again
// (docs/vnext/PLAN.md 3.1 and 12).
import type { AskResult, AskVia, PipSay, PipState } from '../shared/protocol';
import type { ChipKind } from '../state/store';
import { AskPip } from './AskPip';
import { CloseIcon } from './Icons';
import { Pip } from './Pip';

export function PipButton({ pip, onOpen }: { pip: PipState; onOpen: () => void }) {
  return (
    <button className="pip-fab" onClick={onOpen} aria-label="Ask Pip">
      <Pip state={pip === 'thinking' ? 'thinking' : 'idle'} size={48} />
    </button>
  );
}

interface Props {
  pip: PipState;
  chips: { kind: ChipKind; items: string[] };
  say: PipSay | null;
  onAsk: (text: string, via: AskVia) => Promise<AskResult | null>;
  onSomethingElse: () => void;
  onClose: () => void;
}

export function PipSheet({ pip, chips, say, onAsk, onSomethingElse, onClose }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet sheet--pip"
        role="dialog"
        aria-label="Pip"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__header">
          <h2 className="title">Pip</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close Pip">
            <CloseIcon />
          </button>
        </header>
        <AskPip
          pip={pip}
          chips={chips}
          say={say}
          isThinking={pip === 'thinking'}
          onAsk={onAsk}
          onSomethingElse={onSomethingElse}
        />
      </section>
    </div>
  );
}
