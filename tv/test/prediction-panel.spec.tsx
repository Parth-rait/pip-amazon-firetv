import 'react-native';
import {render} from '@testing-library/react-native';
import * as React from 'react';
import {PredictionPanel} from '../src/components/PredictionPanel';
import type {PlayerView, PredictionView} from '../src/shared/protocol';

const players: PlayerView[] = [
  {id: 'p1', name: 'Mom', avatar: 0, score: 0, online: true},
  {id: 'p2', name: 'Leo', avatar: 1, score: 0, online: true},
];

const open: PredictionView = {
  id: 'cave-dragon',
  question: 'Who do you think the big dragon in the cave is?',
  choices: ['The dragon that took Scales', 'Scales, all grown up'],
  status: 'open',
  votedIds: ['p2'],
  answer: null,
  reveal: null,
  picks: null,
};

describe('PredictionPanel', () => {
  it('shows who has guessed but not what, before the reveal', () => {
    const screen = render(
      <PredictionPanel prediction={open} players={players} accent="#7CE7C4" />,
    );
    expect(
      screen.getByText('1 of 2 have guessed. Guess on your phone.'),
    ).toBeTruthy();
    expect(screen.getAllByLabelText('Leo')).toHaveLength(1); // Leo's avatar once, in the guessed row
  });

  it('shows each guess under its choice and the reveal line after the reveal', () => {
    const screen = render(
      <PredictionPanel
        prediction={{
          ...open,
          status: 'revealed',
          answer: 1,
          reveal: 'It is Scales, all grown up.',
          picks: {p1: 0, p2: 1},
        }}
        players={players}
        accent="#7CE7C4"
      />,
    );
    expect(screen.getByText('It is Scales, all grown up.')).toBeTruthy();
    expect(screen.getByLabelText('Mom')).toBeTruthy();
    expect(screen.getByLabelText('Leo')).toBeTruthy();
  });
});
