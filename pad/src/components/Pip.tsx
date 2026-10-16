// Pip, drawn with CSS: a circle in Pip's color with two eyes. The state comes from the server
// (section 3.4); the face follows the host's mood through data-pip-mood on the page (2.4).
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
      {/* Shown by mood (data-pip-mood on the page): a sassy brow, playful cheeks. */}
      <span className="pip__brow" aria-hidden="true" />
      <span className="pip__cheek pip__cheek--left" aria-hidden="true" />
      <span className="pip__cheek pip__cheek--right" aria-hidden="true" />
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
