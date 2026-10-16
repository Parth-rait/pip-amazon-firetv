// "What happens next?": Pip asks, everyone guesses on their own pad, and the reveal comes when
// the film gets there. Nobody sees what others picked until then.
import { useEffect, useState } from 'react';
import { vibrateRight } from '../lib/haptics';
import type { PredictionView } from '../shared/protocol';
import { Pip } from './Pip';

interface Props {
  prediction: PredictionView;
  myId: string;
  playerCount: number;
  onVote: (id: string, choice: number) => void;
}

export function PredictionCard({ prediction, myId, playerCount, onVote }: Props) {
  // My vote as I tapped it; the server's picks take over at the reveal.
  const [mine, setMine] = useState<{ id: string; choice: number } | null>(null);
  const myChoice =
    prediction.picks?.[myId] ?? (mine?.id === prediction.id ? mine.choice : undefined);
  const isRevealed = prediction.status === 'revealed';
  const gotIt = isRevealed && myChoice === prediction.answer;
  useEffect(() => {
    if (gotIt) vibrateRight();
  }, [gotIt, prediction.id]);

  const headline = !isRevealed
    ? 'What happens next?'
    : myChoice === undefined
      ? 'Here is what happened.'
      : gotIt
        ? 'You guessed it!'
        : 'Not this time.';

  return (
    <section className={isRevealed ? 'predict predict--revealed' : 'predict'} aria-live="polite">
      <div className="predict__head">
        <Pip state={gotIt ? 'cheer' : 'idle'} size={32} />
        <p className="label">{headline}</p>
      </div>
      <p className="predict__question">{prediction.question}</p>
      <div className="predict__choices">
        {prediction.choices.map((choice, i) => {
          const isMine = myChoice === i;
          const isRight = isRevealed && prediction.answer === i;
          const cls = [
            'predict__choice',
            isMine && 'is-mine',
            isRight && 'is-right',
            isRevealed && !isRight && 'is-dim',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={i}
              className={cls}
              disabled={isRevealed}
              onClick={() => {
                setMine({ id: prediction.id, choice: i });
                onVote(prediction.id, i);
              }}
            >
              {choice}
            </button>
          );
        })}
      </div>
      <p className="caption">
        {isRevealed
          ? prediction.reveal
          : myChoice === undefined
            ? 'Tap your guess. Pip reveals it when the film gets there.'
            : `Locked in. ${prediction.votedIds.length} of ${playerCount} have guessed; you can change yours until the reveal.`}
      </p>
    </section>
  );
}
