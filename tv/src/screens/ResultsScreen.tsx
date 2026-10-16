import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  PIP_COLORS,
  type ResultsView,
  type SessionView,
} from '../shared/protocol';
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
  const accent = PIP_COLORS[view.pipStyle.color];
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
                <Text style={styles.score}>{row.score}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.right}>
        <Pip state={view.pip} size={dp(220)} color={accent} />
        <Text style={styles.family}>
          {familyLine(results.correct, results.answers)}
        </Text>
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
  score: {color: color.text, fontSize: type.title, fontWeight: '700'},
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
});
