import 'react-native';
import {render} from '@testing-library/react-native';
import * as React from 'react';
import {ChoiceGrid} from '../src/components/ChoiceGrid';
import {familyLine} from '../src/quiz-lines';
import type {PlayerView, QuizView} from '../src/shared/protocol';

const players: PlayerView[] = [
  {id: 'p1', name: 'Mom', avatar: 0, score: 0, online: true},
  {id: 'p2', name: 'Leo', avatar: 1, score: 0, online: true},
];

function quiz(over: Partial<QuizView>): QuizView {
  return {
    index: 0,
    total: 5,
    phase: 'question',
    question: 'Where does the big bunny sleep?',
    choices: ['In a burrow', 'In a nest', 'In a cave', 'On a rock'],
    secondsLeft: 20,
    answeredIds: ['p1', 'p2'],
    correct: null,
    explanation: null,
    picks: null,
    ...over,
  };
}

describe('ChoiceGrid', () => {
  it('shows nobody under any choice before the reveal', () => {
    const screen = render(
      <ChoiceGrid quiz={quiz({})} players={players} accent="#7CE7C4" />,
    );
    expect(screen.queryByText('M')).toBeNull();
    expect(screen.queryByText('L')).toBeNull();
  });

  it('shows each player under the choice they picked in the reveal', () => {
    const screen = render(
      <ChoiceGrid
        quiz={quiz({
          phase: 'reveal',
          correct: 0,
          explanation: 'He sleeps in a burrow.',
          picks: {p1: 0, p2: 2},
        })}
        players={players}
        accent="#7CE7C4"
      />,
    );
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.getByText('L')).toBeTruthy();
  });
});

describe('familyLine', () => {
  it('says the family total, or that nobody answered', () => {
    expect(familyLine(9, 10)).toBe('Together you got 9 of 10 right.');
    expect(familyLine(0, 0)).toBe('No answers this time.');
  });
});
