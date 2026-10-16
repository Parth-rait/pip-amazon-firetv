// Pip, a little screen buddy in the spirit of Bandhu (RouteMate): a rounded body, a light face
// panel, big eyes, small cheeks and a smile. It only bobs and blinks; the server's state picks the
// face (docs/vnext/PLAN.md 3.1: one quiet, recognisable character).
import type { PipState } from '../shared/protocol';

export function Pip({ state, size = 48 }: { state: PipState; size?: number }) {
  return (
    <svg
      className={`pip pip--${state}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Pip is ${state}`}
    >
      <ellipse className="pip-shadow" cx="60" cy="113" rx="30" ry="5" />
      <g className="pip-body">
        <g className="pip-antenna">
          <path d="M47 16 L39 5 M73 16 L81 5" />
          <circle cx="38" cy="4.5" r="4" />
          <circle cx="82" cy="4.5" r="4" />
        </g>
        <rect className="pip-shell" x="14" y="15" width="92" height="82" rx="27" />
        <rect className="pip-band" x="22" y="80" width="76" height="9" rx="4.5" />
        <rect className="pip-face" x="24" y="27" width="72" height="47" rx="17" />
        <g className="pip-eyes">
          <ellipse cx="47" cy="48" rx="6" ry="7.5" />
          <ellipse cx="73" cy="48" rx="6" ry="7.5" />
          <circle className="pip-shine" cx="49" cy="45" r="2" />
          <circle className="pip-shine" cx="75" cy="45" r="2" />
        </g>
        <g className="pip-happy">
          <path d="M41 50 Q47 42 53 50 M67 50 Q73 42 79 50" />
        </g>
        <g className="pip-closed">
          <path d="M41 49 Q47 53 53 49 M67 49 Q73 53 79 49" />
        </g>
        <circle className="pip-cheek" cx="34" cy="61" r="4.5" />
        <circle className="pip-cheek" cx="86" cy="61" r="4.5" />
        <path className="pip-smile" d="M52 60 Q60 67 68 60" />
        <ellipse className="pip-o" cx="60" cy="62" rx="4" ry="4.6" />
        <rect className="pip-foot" x="28" y="95" width="18" height="9" rx="4.5" />
        <rect className="pip-foot" x="74" y="95" width="18" height="9" rx="4.5" />
      </g>
      <g className="pip-think">
        <circle cx="103" cy="18" r="3.4" />
        <circle cx="111" cy="9" r="4.4" />
      </g>
    </svg>
  );
}
