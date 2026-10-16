// The host's remote on the Pip Pad: play/pause and ±10 s, the film's volume, the picture's
// brightness and the light scene. Each tap is a semantic input with no model call, and the status
// line says whether the TV really did it (docs/vnext/PLAN.md 8.2).
import type { AmbientScene, DeviceView, PipInputEvent, Playback } from '../shared/protocol';
import { actionLabel } from '../lib/commands';
import { BackIcon, ForwardIcon, PauseIcon, PlayIcon } from './Icons';

const SKIP_SEC = 10;
const STEP = 0.1;

const SCENES: { scene: AmbientScene; label: string }[] = [
  { scene: 'off', label: 'Off' },
  { scene: 'movie', label: 'Movie' },
  { scene: 'bright', label: 'Bright' },
];

function statusLine(device: DeviceView): string | null {
  const last = device.lastAction;
  if (!last) return null;
  const label = actionLabel(last.action);
  if (last.action.startsWith('ambient.')) return `${label} (simulated).`;
  if (last.ok === null) return `${label}: sending to the TV...`;
  if (last.ok) return `${label}: done on the TV.`;
  return `${label}: the TV did not confirm it. Try again.`;
}

interface Props {
  playback: Playback | null;
  device: DeviceView;
  onInput: (event: PipInputEvent) => void;
}

export function Remote({ playback, device, onInput }: Props) {
  const isPaused = playback?.paused ?? false;
  const status = statusLine(device);
  return (
    <section className="remote" aria-label="Remote">
      <div className="remote__row">
        <button
          className="remote__button"
          onClick={() => onInput({ type: 'media.seekRelative', seconds: -SKIP_SEC })}
          aria-label="Back 10 seconds"
        >
          <BackIcon />
          <span className="remote__hint">10</span>
        </button>
        <button
          className="remote__button remote__button--main"
          onClick={() => onInput({ type: isPaused ? 'media.play' : 'media.pause' })}
          aria-label={isPaused ? 'Play' : 'Pause'}
        >
          {isPaused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button
          className="remote__button"
          onClick={() => onInput({ type: 'media.seekRelative', seconds: SKIP_SEC })}
          aria-label="Forward 10 seconds"
        >
          <ForwardIcon />
          <span className="remote__hint">10</span>
        </button>
      </div>

      <Stepper
        label="Volume"
        value={device.volume}
        onDown={() => onInput({ type: 'media.volumeDelta', delta: -STEP })}
        onUp={() => onInput({ type: 'media.volumeDelta', delta: STEP })}
      />
      <Stepper
        label="Brightness"
        value={device.brightness}
        onDown={() => onInput({ type: 'media.brightnessDelta', delta: -STEP })}
        onUp={() => onInput({ type: 'media.brightnessDelta', delta: STEP })}
      />

      <div className="remote__lights">
        <span className="label">Lights</span>
        <div className="segmented" role="radiogroup" aria-label="Lights">
          {SCENES.map(({ scene, label }) => (
            <button
              key={scene}
              role="radio"
              aria-checked={device.ambient === scene}
              className={device.ambient === scene ? 'segmented__item is-on' : 'segmented__item'}
              onClick={() => onInput({ type: 'ambient.set', scene })}
            >
              {label}
            </button>
          ))}
        </div>
        {device.lights === 'simulated' && (
          <p className="caption">Simulated: no smart lights are connected yet.</p>
        )}
      </div>

      {status && (
        <p className="caption remote__status" aria-live="polite">
          {status}
        </p>
      )}
    </section>
  );
}

function Stepper({
  label,
  value,
  onDown,
  onUp,
}: {
  label: string;
  value: number;
  onDown: () => void;
  onUp: () => void;
}) {
  const percent = Math.round(value * 100);
  return (
    <div className="stepper">
      <span className="stepper__label">{label}</span>
      <button className="stepper__button" onClick={onDown} aria-label={`${label} down`}>
        −
      </button>
      <div
        className="stepper__track"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="stepper__fill" style={{ width: `${percent}%` }} />
      </div>
      <button className="stepper__button" onClick={onUp} aria-label={`${label} up`}>
        +
      </button>
    </div>
  );
}
