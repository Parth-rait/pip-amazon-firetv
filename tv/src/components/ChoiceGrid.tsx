import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {PlayerView, QuizView} from '../shared/protocol';
import {letterOf} from '../quiz-lines';
import {color, dp, radius, space, type} from '../theme';
import {Avatar} from './Avatar';

/**
 * The four choices in a 2 x 2 grid (PROJECT.md 3.3). Before the reveal they all look the same;
 * in the reveal the right one turns Pip's color, the others dim, and each player's avatar sits
 * under the choice they picked. The TV never shows a pick before the reveal.
 */
export function ChoiceGrid({
  quiz,
  players,
  accent,
}: {
  quiz: QuizView;
  players: PlayerView[];
  accent: string;
}) {
  const isReveal = quiz.phase === 'reveal';
  return (
    <View style={styles.grid}>
      {quiz.choices.map((choice, i) => {
        const isRight = isReveal && quiz.correct === i;
        const pickers = isReveal
          ? players.filter((p) => quiz.picks?.[p.id] === i)
          : [];
        return (
          <View key={i} style={styles.cell}>
            <View
              style={[
                styles.tile,
                isRight && {backgroundColor: accent},
                isReveal && !isRight && styles.dim,
              ]}>
              <Text style={[styles.letter, isRight && styles.onAccent]}>
                {letterOf(i)}
              </Text>
              <Text
                style={[styles.choice, isRight && styles.onAccent]}
                numberOfLines={2}>
                {choice}
              </Text>
            </View>
            <View style={styles.pickers}>
              {pickers.map((p) => (
                <Avatar
                  key={p.id}
                  name={p.name}
                  avatar={p.avatar}
                  size={dp(44)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: space.xl},
  cell: {width: '48.5%', gap: space.s},
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    minHeight: dp(132),
    paddingHorizontal: space.xxl,
    borderRadius: radius,
    backgroundColor: color.surface,
  },
  dim: {opacity: 0.4},
  letter: {color: color.textMuted, fontSize: type.title, fontWeight: '700'},
  choice: {flex: 1, color: color.text, fontSize: type.title},
  onAccent: {color: color.bg},
  pickers: {flexDirection: 'row', gap: space.s, minHeight: dp(44)},
});
