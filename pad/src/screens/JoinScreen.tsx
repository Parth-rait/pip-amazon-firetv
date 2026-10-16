// JOIN: the code from the TV and a first name (PROJECT.md section 3.3).
import { useRef, useState, type FormEvent } from 'react';
import { Pip } from '../components/Pip';
import { cleanCodeInput, isFullCode } from '../lib/format';
import { LIMITS } from '../shared/protocol';
import type { JoinFailure } from '../state/store';

const JOIN_ERRORS: Record<JoinFailure, string> = {
  'unknown-code': 'Looking for your TV. Check the code on the screen.',
  full: 'This TV already has 8 players.',
  'rate-limited': 'Too many tries. Waiting a moment.',
  invalid: 'Type the code from the TV and your first name.',
};

interface Props {
  initialCode: string;
  initialName: string;
  error: JoinFailure | null;
  isOnline: boolean;
  onJoin: (code: string, name: string) => Promise<unknown>;
}

export function JoinScreen({ initialCode, initialName, error, isOnline, onJoin }: Props) {
  const [code, setCode] = useState(cleanCodeInput(initialCode));
  const [name, setName] = useState(initialName);
  const [isJoining, setIsJoining] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const setBox = (index: number, raw: string) => {
    const typed = cleanCodeInput(raw);
    const chars = [...code.padEnd(LIMITS.codeLength, ' ')];
    // Pasting a whole code fills every box; typing one letter fills this box and moves on.
    if (typed.length > 1) {
      setCode(typed);
      boxes.current[Math.min(typed.length, LIMITS.codeLength - 1)]?.focus();
      return;
    }
    chars[index] = typed || ' ';
    setCode(chars.join('').trimEnd().replace(/ /g, ''));
    if (typed) boxes.current[index + 1]?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!isFullCode(code) || trimmed.length === 0) {
      setLocalError(JOIN_ERRORS.invalid);
      return;
    }
    setLocalError(null);
    setIsJoining(true);
    await onJoin(code, trimmed);
    setIsJoining(false);
  };

  const message = localError ?? (error ? JOIN_ERRORS[error] : null);

  return (
    <main className="screen screen--join">
      <div className="join-hero">
        <Pip state="sleep" size={88} />
        <h1 className="large-title">Join the TV</h1>
      </div>
      <form className="stack" onSubmit={submit}>
        <label className="label" htmlFor="code-0">
          Code on the TV
        </label>
        <div className="code-boxes">
          {Array.from({ length: LIMITS.codeLength }, (_, i) => (
            <input
              key={i}
              id={`code-${i}`}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              className="code-box"
              value={code[i] ?? ''}
              onChange={(e) => setBox(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !code[i]) boxes.current[i - 1]?.focus();
              }}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              aria-label={`Code letter ${i + 1}`}
            />
          ))}
        </div>
        <label className="label" htmlFor="name">
          First name
        </label>
        <input
          id="name"
          className="text-input"
          value={name}
          maxLength={LIMITS.nameMaxChars}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
        />
        <p className="caption">
          First name or nickname. Pip forgets it after the session; this device remembers it.
        </p>
        {message && <p className="error">{message}</p>}
        <button
          className="button button--wide button--accent"
          type="submit"
          disabled={isJoining || !isOnline}
        >
          Join
        </button>
      </form>
    </main>
  );
}
