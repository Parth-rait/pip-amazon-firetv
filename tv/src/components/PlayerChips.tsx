import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {PlayerView} from '../shared/protocol';
import {color, radius, space, type} from '../theme';

/** The players in join order: the host marked, offline players dimmed, answered ones in mint. */
export function PlayerChips({
  players,
  hostId,
  highlightIds,
}: {
  players: PlayerView[];
  hostId: string | null;
  highlightIds?: string[];
}) {
  return (
    <View style={styles.row}>
      {players.map((p) => {
        const lit = highlightIds?.includes(p.id) ?? false;
        return (
          <View key={p.id} style={[styles.chip, lit && styles.chipLit]}>
            <Text
              style={[
                styles.name,
                !p.online && styles.offline,
                lit && styles.nameLit,
              ]}>
              {p.name}
              {p.id === hostId ? (
                <Text style={styles.host}> (host)</Text>
              ) : null}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: space.l},
  chip: {
    paddingHorizontal: space.xl,
    paddingVertical: space.m,
    borderRadius: radius,
    backgroundColor: color.surface,
  },
  chipLit: {backgroundColor: color.accent},
  name: {color: color.text, fontSize: type.body},
  nameLit: {color: color.bg},
  offline: {color: color.textMuted},
  host: {fontSize: type.caption, color: color.textMuted},
});
