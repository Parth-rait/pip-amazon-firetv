// ?lab=1: a simulated Pip Pad button and touchwheel. They send the same raw inputs a real board
// would (pad:input), so the server's adapters decide what they mean. Development only.
import { useRef, useState, type PointerEvent } from 'react';
import { newId } from '../lib/ids';
import type { InputEnvelope, InputResult } from '../shared/protocol';

const LONG_PRESS_MS = 600;
const DOUBLE_PRESS_MS = 300;
const DEGREES_PER_DETENT = 30;
const WHEEL_SEND_MS = 150; // coalesce a spin into one event

interface Props {
  onInput: (
    input: InputEnvelope['input'],
    source: InputEnvelope['source'],
    eventId: string,
  ) => Promise<InputResult | null>;
}

export function LabPanel({ onInput }: Props) {
  const [last, setLast] = useState('Tap, double-tap or hold the button. Drag around the wheel.');
  const pressAt = useRef(0);
  const singleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wheel = useRef<{
    angle: number | null;
    pending: number;
    timer?: ReturnType<typeof setTimeout>;
  }>({ angle: null, pending: 0 });

  const send = async (input: InputEnvelope['input'], source: InputEnvelope['source']) => {
    const result = await onInput(input, source, newId('lab'));
    const what =
      input.kind === 'wheel'
        ? `wheel ${input.detents > 0 ? '+' : ''}${input.detents}`
        : input.kind === 'button'
          ? input.gesture
          : input.key;
    setLast(
      !result
        ? `${what}: no answer`
        : result.ok
          ? `${what} → ${result.intent}`
          : `${what} → ${result.reason}`,
    );
  };

  const buttonUp = () => {
    const held = Date.now() - pressAt.current;
    if (held >= LONG_PRESS_MS)
      return void send({ kind: 'button', gesture: 'long-press' }, 'pad-button');
    if (singleTimer.current) {
      clearTimeout(singleTimer.current);
      singleTimer.current = undefined;
      return void send({ kind: 'button', gesture: 'double-press' }, 'pad-button');
    }
    singleTimer.current = setTimeout(() => {
      singleTimer.current = undefined;
      void send({ kind: 'button', gesture: 'press' }, 'pad-button');
    }, DOUBLE_PRESS_MS);
  };

  const wheelMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const angle =
      (Math.atan2(
        event.clientY - box.top - box.height / 2,
        event.clientX - box.left - box.width / 2,
      ) *
        180) /
      Math.PI;
    const state = wheel.current;
    if (state.angle === null) return void (state.angle = angle);
    let delta = angle - state.angle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const detents = Math.trunc(delta / DEGREES_PER_DETENT);
    if (detents === 0) return;
    state.angle += detents * DEGREES_PER_DETENT;
    state.pending += detents;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      const total = state.pending;
      state.pending = 0;
      if (total !== 0) void send({ kind: 'wheel', detents: total }, 'pad-wheel');
    }, WHEEL_SEND_MS);
  };

  return (
    <section className="lab" aria-label="Simulated Pip Pad hardware">
      <p className="label">Simulated hardware (lab)</p>
      <div className="lab__row">
        <button
          className="lab__button"
          onPointerDown={() => void (pressAt.current = Date.now())}
          onPointerUp={buttonUp}
          aria-label="Pip button"
        >
          Pip
        </button>
        <div
          className="lab__wheel"
          role="slider"
          aria-label="Touchwheel: drag clockwise to skip ahead"
          aria-valuenow={0}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            wheel.current.angle = null;
          }}
          onPointerMove={wheelMove}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') void send({ kind: 'wheel', detents: 1 }, 'pad-wheel');
            if (e.key === 'ArrowLeft') void send({ kind: 'wheel', detents: -1 }, 'pad-wheel');
          }}
        />
      </div>
      <p className="caption" role="status">
        {last}
      </p>
    </section>
  );
}
