// QUIZ: the question, A to D, the time left, then the reveal; the host moves it on (section 3.3).
import { useEffect, useState } from 'react';
import { AnswerButtons } from '../components/AnswerButtons';
import { vibrateRight } from '../lib/haptics';
import { revealLine } from '../lib/quiz-lines';
import { Confetti } from '../components/Confetti';
import { Stars } from '../components/Stars';
import type { HostCommand, QuizView } from '../shared/protocol';

const TICK_MS = 250;
// The host's button changes meaning in place (Next question becomes Reveal now), so it waits a
// moment after each change: the second tap of a double tap must not reveal the new question.
const HOST_BUTTON_SETTLE_MS = 800;

interface Props {
  quiz: QuizView;
  viewAt: number;
  myId: string;
  isHost: boolean;
  onAnswer: (index: number, choice: number) => void;
  onCommand: (command: HostCommand) => void;
}

export function QuizScreen({ quiz, viewAt, myId, isHost, onAnswer, onCommand }: Props) {
  const [pick, setPick] = useState<{ index: number; choice: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const isReveal = quiz.phase === 'reveal';
  const picked = isReveal
    ? (quiz.picks?.[myId] ?? null)
    : pick?.index === quiz.index
      ? pick.choice
      : null;
  const isRight = isReveal && quiz.picks?.[myId] === quiz.correct;

  useEffect(() => {
    if (isReveal) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [isReveal]);

  const step = `${quiz.index}:${quiz.phase}`;
  const [settledStep, setSettledStep] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettledStep(step), HOST_BUTTON_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (isRight) vibrateRight();
  }, [isRight, quiz.index]);

  const secondsLeft = Math.max(0, quiz.secondsLeft - Math.floor(Math.max(0, now - viewAt) / 1000));
  const isLast = quiz.index + 1 >= quiz.total;

  return (
    <main className="screen">
      <header className="quiz-header">
        <span className="caption">
          {quiz.index + 1} of {quiz.total}
        </span>
        {!isReveal && <span className="caption">{secondsLeft} s</span>}
      </header>
      <h1 className="title">{quiz.question}</h1>
      <AnswerButtons
        choices={quiz.choices}
        picked={picked}
        correct={quiz.correct}
        isLocked={isReveal}
        onPick={(choice) => {
          setPick({ index: quiz.index, choice });
          onAnswer(quiz.index, choice);
        }}
      />
      {isRight && <Confetti key={quiz.index} />}
      {isReveal ? (
        <section className="stack">
          <p className={isRight ? 'reveal-line reveal-line--right' : 'reveal-line'}>
            {isRight && <Stars filled={1} total={1} size={28} />}
            {revealLine(quiz, myId)}
          </p>
          {quiz.explanation && <p className="body muted">{quiz.explanation}</p>}
        </section>
      ) : (
        <p className="caption">You can change it until the reveal.</p>
      )}
      {isHost && (
        <button
          className="button button--wide button--accent"
          disabled={settledStep !== step}
          onClick={() => onCommand({ type: 'next', index: quiz.index, phase: quiz.phase })}
        >
          {!isReveal ? 'Reveal now' : isLast ? 'See results' : 'Next question'}
        </button>
      )}
    </main>
  );
}
