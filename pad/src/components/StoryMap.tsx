// Parallel Stories on the Pip Pad: the film as a solid lane up to the split, Pip's version as a
// dotted Electric lane after it, and the film after the split only as far as it was watched. Every
// button is a real step: a question Pip answers in the branch, or Back to the film.
import { useState, type FormEvent } from 'react';
import { formatClock } from '../lib/format';
import type { BranchView } from '../shared/protocol';

interface Props {
  branch: BranchView;
  isBusy: boolean; // Pip is answering: one step at a time
  onAsk: (question: string) => void;
  onBackToFilm: () => void;
}

export function StoryMap({ branch, isBusy, onAsk, onBackToFilm }: Props) {
  const [isChanging, setIsChanging] = useState(false);
  const [change, setChange] = useState('');

  const submitChange = (event: FormEvent) => {
    event.preventDefault();
    const text = change.trim();
    if (!text) return;
    // Pip hears a change as another "what if" on the same split.
    onAsk(/^(what if|imagine|suppose)\b/i.test(text) ? text : `What if ${text}`);
    setChange('');
    setIsChanging(false);
  };

  return (
    <section className="story-map" aria-label="Parallel story">
      <header className="story-map__head">
        <p className="label">Parallel story</p>
        <h2 className="title">{branch.premise}</h2>
        {branch.changes.length > 1 && (
          <p className="caption">Changed {branch.changes.length - 1}× from the same split.</p>
        )}
      </header>

      <ol className="lane lane--film" aria-label="The film">
        <li className="lane__label">The film</li>
        {branch.film.map((line) => (
          <li key={`f-${line.atSec}`} className="lane__event">
            <span className="lane__time">{formatClock(line.atSec)}</span>
            <span>{line.text}</span>
          </li>
        ))}
      </ol>

      <p className="split-marker">
        <span>Split at {formatClock(branch.splitSec)}</span>
      </p>

      <div className="lanes-after">
        <ol className="lane lane--pip" aria-label="Pip's version">
          <li className="lane__label">Pip&apos;s version · made up</li>
          {branch.pip.map((event) => (
            <li key={event.id} className="lane__event">
              <span className="lane__time">{event.order}</span>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
        {(branch.after.length > 0 || branch.unseenAfter > 0) && (
          <ol className="lane lane--film lane--after" aria-label="The film after the split">
            <li className="lane__label">The film went on</li>
            {branch.after.map((line) => (
              <li key={`a-${line.atSec}`} className="lane__event">
                <span className="lane__time">{formatClock(line.atSec)}</span>
                <span>{line.text}</span>
              </li>
            ))}
            {branch.unseenAfter > 0 && (
              <li className="lane__event lane__event--hidden">You haven&apos;t seen this yet.</li>
            )}
          </ol>
        )}
      </div>

      {isChanging ? (
        <form className="story-map__change" onSubmit={submitChange}>
          <input
            className="text-input"
            value={change}
            onChange={(e) => setChange(e.target.value)}
            placeholder="What if… (one change)"
            aria-label="Change one thing"
            autoFocus
          />
          <button className="button" type="submit" disabled={isBusy || !change.trim()}>
            Rewrite
          </button>
        </form>
      ) : null}

      <div className="story-map__actions">
        <button
          className="button button--accent"
          disabled={isBusy}
          onClick={() => onAsk('What happens next?')}
        >
          Continue this story
        </button>
        <button className="button" disabled={isBusy} onClick={() => setIsChanging((v) => !v)}>
          Change one thing
        </button>
        <button className="button" disabled={isBusy} onClick={() => onAsk('Where did it split?')}>
          Where did it split?
        </button>
        <button className="button" onClick={onBackToFilm}>
          Back to the film
        </button>
      </div>
    </section>
  );
}
