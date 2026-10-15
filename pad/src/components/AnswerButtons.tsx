// The four quiz answers, A to D, at least 96 px tall (section 3.1, rule 10).
import { LETTERS } from '../lib/quiz-lines';

interface Props {
  choices: string[];
  picked: number | null; // my choice, outlined in mint
  correct: number | null; // set in the reveal
  isLocked: boolean;
  onPick: (choice: number) => void;
}

export function AnswerButtons({ choices, picked, correct, isLocked, onPick }: Props) {
  return (
    <div className="answers">
      {choices.map((choice, i) => {
        const classes = ['answer-button'];
        if (i === picked) classes.push('answer-button--picked');
        if (correct !== null)
          classes.push(i === correct ? 'answer-button--right' : 'answer-button--dim');
        return (
          <button
            key={LETTERS[i]}
            className={classes.join(' ')}
            disabled={isLocked}
            aria-pressed={i === picked}
            onClick={() => onPick(i)}
          >
            <span className="answer-button__letter">{LETTERS[i]}</span>
            {choice}
          </button>
        );
      })}
    </div>
  );
}
