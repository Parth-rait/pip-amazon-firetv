// "Make Pip yours": the host picks Pip's mood and color; every screen follows at once (section 2.4).
import {
  PIP_COLORS,
  type HostCommand,
  type PipColor,
  type PipMood,
  type PipStyle,
} from '../shared/protocol';
import { CloseIcon } from './Icons';
import { Pip } from './Pip';

const MOODS: { mood: PipMood; label: string; sample: string }[] = [
  { mood: 'chill', label: 'Chill', sample: 'Calm and gentle. "Hello Leo. Settle in."' },
  { mood: 'playful', label: 'Playful', sample: 'Warm and a little funny. "Hi Leo! Grab a snack."' },
  {
    mood: 'sassy',
    label: 'Sassy',
    sample: 'Cheeky, never mean. "Well, well. Leo finally made it."',
  },
];

const COLORS: { color: PipColor; label: string }[] = [
  { color: 'mint', label: 'Mint' },
  { color: 'coral', label: 'Coral' },
  { color: 'lilac', label: 'Lilac' },
  { color: 'sun', label: 'Sun' },
];

interface Props {
  style: PipStyle;
  onCommand: (command: HostCommand) => void;
  onClose: () => void;
}

export function PipStyleSheet({ style, onCommand, onClose }: Props) {
  const set = (next: Partial<PipStyle>) =>
    onCommand({ type: 'pip-style', style: { ...style, ...next } });
  const sample = MOODS.find((m) => m.mood === style.mood)?.sample ?? '';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-label="Make Pip yours"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__header">
          <h2 className="title">Make Pip yours</h2>
          <button className="icon-button" onClick={onClose} aria-label="Done">
            <CloseIcon />
          </button>
        </header>
        <div className="sheet__preview">
          <Pip state="talking" size={72} />
        </div>

        <p className="label">Mood</p>
        <div className="segmented" role="radiogroup" aria-label="Mood">
          {MOODS.map(({ mood, label }) => (
            <button
              key={mood}
              role="radio"
              aria-checked={style.mood === mood}
              className={style.mood === mood ? 'segmented__item is-on' : 'segmented__item'}
              onClick={() => set({ mood })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="caption">{sample}</p>

        <p className="label">Color</p>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {COLORS.map(({ color, label }) => (
            <button
              key={color}
              role="radio"
              aria-checked={style.color === color}
              aria-label={label}
              className={style.color === color ? 'swatch is-on' : 'swatch'}
              style={{ background: PIP_COLORS[color] }}
              onClick={() => set({ color })}
            />
          ))}
        </div>
        <p className="caption">Pip changes on the TV and on everyone's screen.</p>
      </section>
    </div>
  );
}
