// A row of stars: one filled for each point, empty for the rest.
const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';

export function Stars({
  filled,
  total,
  size = 22,
}: {
  filled: number;
  total: number;
  size?: number;
}) {
  return (
    <span className="stars" role="img" aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path
            d={STAR}
            fill={i < filled ? '#FFD166' : 'none'}
            stroke={i < filled ? '#FFD166' : 'currentColor'}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
