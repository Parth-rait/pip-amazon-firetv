import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {type ResultsView, type SessionView} from '../shared/protocol';
import {Avatar} from '../components/Avatar';
import {Pip} from '../components/Pip';
import {familyLine} from '../quiz-lines';
import {color, dp, radius, safe, space, type} from '../theme';

/** RESULTS (PROJECT.md 3.3): the standings (equal scores share a place), the family total
 *  and Pip cheering. */
export function ResultsScreen({
  view,
  results,
}: {
  view: SessionView;
  results: ResultsView;
}) {
  const accent = color.accent;
  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <Text style={styles.title}>Results</Text>
        <View style={styles.rows}>
          {results.ranking.map((row) => {
            const player = view.players.find((p) => p.id === row.playerId);
            const isFirst = row.place === 1 && row.score > 0;
            return (
              <View key={row.playerId} style={styles.row}>
                <Text style={[styles.place, isFirst && {color: accent}]}>
                  {row.place}
                </Text>
                <Avatar
                  name={row.name}
                  avatar={player?.avatar ?? 0}
                  size={dp(56)}
                />
                <Text style={styles.name} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text
                  style={styles.score}
                  accessibilityLabel={`${row.score} points`}>
                  {'\u2605'.repeat(row.score)}
                  <Text style={styles.emptyStars}>
                    {'\u2606'.repeat(
                      Math.max(0, results.questions - row.score),
                    )}
                  </Text>
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.right}>
        <Pip state={view.pip} size={dp(220)} />
        <Text style={styles.family}>
          {familyLine(results.correct, results.answers)}
        </Text>
        {results.moment ? (
          <View style={styles.moment}>
            <Text style={styles.momentLabel}>
              Favourite moment ({results.moment.reactions} reactions)
            </Text>
            <Text style={styles.momentText} numberOfLines={3}>
              {results.moment.text}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    backgroundColor: color.bg,
    paddingHorizontal: safe.horizontal,
    paddingVertical: safe.vertical,
    gap: space.xxxl,
  },
  left: {flex: 3, gap: space.xl},
  title: {color: color.text, fontSize: type.display, fontWeight: '700'},
  rows: {gap: space.m},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.m,
    borderRadius: radius,
    backgroundColor: color.surface,
  },
  place: {
    color: color.textMuted,
    fontSize: type.title,
    fontWeight: '700',
    minWidth: dp(40),
  },
  name: {flex: 1, color: color.text, fontSize: type.title},
  score: {color: '#FFD166', fontSize: type.title, letterSpacing: dp(4)},
  emptyStars: {color: color.textMuted},
  right: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxl,
  },
  family: {
    color: color.text,
    fontSize: type.title,
    textAlign: 'center',
  },
  moment: {
    gap: space.xs,
    padding: space.xl,
    borderRadius: radius,
    backgroundColor: color.surface,
  },
  momentLabel: {color: color.textMuted, fontSize: type.caption},
  momentText: {color: color.text, fontSize: type.caption},
});
