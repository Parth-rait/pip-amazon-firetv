import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {PlayerView, PredictionView} from '../shared/protocol';
import {color, dp, radius, safe, space, type} from '../theme';
import {Avatar} from './Avatar';

/**
 * "What happens next?" over the film: the question and who has guessed (never what), then at
 * the reveal the right choice in Pip's color with everyone's avatar under their guess.
 */
export function PredictionPanel({
  prediction,
  players,
  accent,
}: {
  prediction: PredictionView;
  players: PlayerView[];
  accent: string;
}) {
  const isRevealed = prediction.status === 'revealed';
  const voters = players.filter((p) => prediction.votedIds.includes(p.id));
  return (
    <View style={[styles.panel, {borderColor: accent}]}>
      <Text style={styles.label}>
        {isRevealed ? 'Here is what happened' : 'Pip asks: what happens next?'}
      </Text>
      <Text style={styles.question}>{prediction.question}</Text>
      <View style={styles.choices}>
        {prediction.choices.map((choice, i) => {
          const isRight = isRevealed && prediction.answer === i;
          const pickers = isRevealed
            ? players.filter((p) => prediction.picks?.[p.id] === i)
            : [];
          return (
            <View
              key={i}
              style={[
                styles.choice,
                isRight && {backgroundColor: accent},
                isRevealed && !isRight && styles.dim,
              ]}>
              <Text style={[styles.choiceText, isRight && styles.onAccent]}>
                {choice}
              </Text>
              <View style={styles.pickers}>
                {pickers.map((p) => (
                  <Avatar
                    key={p.id}
                    name={p.name}
                    avatar={p.avatar}
                    size={dp(40)}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
      {isRevealed ? (
        <Text style={styles.foot}>{prediction.reveal}</Text>
      ) : (
        <View style={styles.voters}>
          {voters.map((p) => (
            <Avatar key={p.id} name={p.name} avatar={p.avatar} size={dp(40)} />
          ))}
          <Text style={styles.foot}>
            {voters.length === 0
              ? 'Guess on your phone.'
              : `${voters.length} of ${
                  players.filter((p) => p.online).length
                } have guessed. Guess on your phone.`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: safe.vertical,
    left: safe.horizontal,
    width: dp(820),
    gap: space.m,
    padding: space.xl,
    borderRadius: radius,
    borderWidth: dp(3),
    backgroundColor: 'rgba(11, 11, 15, 0.88)',
  },
  label: {color: color.textMuted, fontSize: type.caption},
  question: {color: color.text, fontSize: type.title, fontWeight: '700'},
  choices: {gap: space.s},
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingVertical: space.m,
    borderRadius: radius,
    backgroundColor: color.surface,
  },
  dim: {opacity: 0.45},
  choiceText: {color: color.text, fontSize: type.body},
  onAccent: {color: color.bg, fontWeight: '700'},
  pickers: {flexDirection: 'row', gap: space.xs},
  voters: {flexDirection: 'row', alignItems: 'center', gap: space.s},
  foot: {color: color.text, fontSize: type.caption},
});
