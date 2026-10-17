// The kids-mode screens (an opt-in, docs/vnext/PLAN.md 3.1), drawn over the paused film. QUIZ:
// the question, A to D in a 2 x 2 grid, a countdown and who has answered (never what). In the
// reveal: the right choice, everyone's picks and Pip's explanation. RESULTS: the ranking and the
// family's favourite moment. The host drives both from their Pip Pad.
import { useEffect, useState } from 'react';
import { Pip } from '../components/Pip';
import { LIMITS, type QuizView, type ResultsView, type SessionView } from '../shared/protocol';
import { Bubble } from './Bubble';
import { PlayerChips } from './PlayerChips';
import { clock } from './store';

const LETTERS = ['A', 'B', 'C', 'D'];

export function Quiz({ view, quiz }: { view: SessionView; quiz: QuizView }) {
  const isReveal = quiz.phase === 'reveal';
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  return (
    <div className="takeover">
      <div className="takeover-top">
        <p className="eyebrow">
          Question {quiz.index + 1} of {quiz.total}
        </p>
        {isReveal ? (
          <p className="eyebrow eyebrow--accent">Answer</p>
        ) : (
          <Countdown key={quiz.index} secondsLeft={quiz.secondsLeft} />
        )}
      </div>
      <h1 className="quiz-question">{quiz.question}</h1>
      <ol className="quiz-grid">
        {quiz.choices.map((choice, i) => {
          const pickedBy = isReveal
            ? Object.entries(quiz.picks ?? {})
                .filter(([, pick]) => pick === i)
                .map(([id]) => names.get(id) ?? '')
                .filter(Boolean)
            : [];
          const state = !isReveal ? '' : i === quiz.correct ? ' is-right' : ' is-dim';
          return (
            <li key={`${quiz.index}-${i}`} className={`quiz-choice${state}`}>
              <span className="quiz-letter">{LETTERS[i]}</span>
              <span className="quiz-text">{choice}</span>
              {pickedBy.length > 0 && <span className="quiz-picks">{pickedBy.join(', ')}</span>}
            </li>
          );
        })}
      </ol>
      <div className="takeover-bottom">
        {!isReveal && <PlayerChips view={view} lit={new Set(quiz.answeredIds)} />}
        <div className="corner corner--inline">
          {isReveal && quiz.explanation && <Bubble text={quiz.explanation} tone="accent" />}
          <Pip state={view.pip === 'sleep' ? 'idle' : view.pip} size={112} />
        </div>
      </div>
    </div>
  );
}

/** Restarts with each question; the server's secondsLeft is where it starts. */
function Countdown({ secondsLeft }: { secondsLeft: number }) {
  const [width, setWidth] = useState(secondsLeft / LIMITS.questionSeconds);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(0));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="countdown" aria-label={`${secondsLeft} seconds left`}>
      <span style={{ width: `${width * 100}%`, transitionDuration: `${secondsLeft}s` }} />
    </div>
  );
}

export function Results({ view, results }: { view: SessionView; results: ResultsView }) {
  return (
    <div className="takeover">
      <div className="takeover-top">
        <p className="eyebrow">Quiz results</p>
        <p className="eyebrow">
          {results.correct} of {results.answers} answers right
        </p>
      </div>
      <ol className="ranking">
        {results.ranking.map((r) => (
          <li key={r.playerId} className={r.place === 1 ? 'is-first' : undefined}>
            <span className="ranking-place">{r.place}</span>
            <span className="ranking-name">{r.name}</span>
            <span className="ranking-score">
              {r.score} of {results.questions}
            </span>
          </li>
        ))}
      </ol>
      <div className="takeover-bottom">
        {results.moment ? (
          <p className="caption">
            Favourite moment, at {clock(results.moment.atSec)}: {results.moment.text} (
            {results.moment.reactions} reactions)
          </p>
        ) : (
          <span />
        )}
        <div className="corner corner--inline">
          <Bubble text="Keep watching from your Pip Pad." />
          <Pip state={view.pip === 'sleep' ? 'cheer' : view.pip} size={112} />
        </div>
      </div>
    </div>
  );
}
