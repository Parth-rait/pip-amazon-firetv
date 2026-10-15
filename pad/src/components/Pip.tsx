// Pip, drawn with CSS: a mint circle with two eyes. The state comes from the server (section 3.4).
import type { PipState } from '../shared/protocol';

export function Pip({ state, size = 48 }: { state: PipState; size?: number }) {
  return (
    <div
      className={`pip pip--${state}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Pip is ${state}`}
    >
      <span className="pip__eye" />
      <span className="pip__eye" />
      {state === 'thinking' && (
        <span className="pip__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
    </div>
  );
}
