import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {PlayerView} from '../shared/protocol';
import {color, dp, space, type} from '../theme';
import {Avatar} from './Avatar';

/** The players in join order: avatar and name, the host marked, offline players dimmed, and a
 *  ring in Pip's color around those who have answered (quiz). */
export function PlayerChips({
  players,
  hostId,
  highlightIds,
  accent = color.accent,
}: {
  players: PlayerView[];
  hostId: string | null;
  highlightIds?: string[];
  accent?: string;
}) {
  return (
    <View style={styles.row}>
      {players.map((p) => {
        const lit = highlightIds?.includes(p.id) ?? false;
        return (
          <View key={p.id} style={styles.player}>
            <View style={[styles.ring, lit && {borderColor: accent}]}>
              <Avatar
                name={p.name}
                avatar={p.avatar}
                size={dp(64)}
                isAway={!p.online}
              />
            </View>
            <Text style={[styles.name, !p.online && styles.offline]}>
              {p.name}
            </Text>
            {p.id === hostId ? <Text style={styles.host}>host</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: space.xxl},
  player: {alignItems: 'center', gap: space.xs, minWidth: dp(96)},
  ring: {
    padding: dp(4),
    borderRadius: dp(64),
    borderWidth: dp(4),
    borderColor: 'transparent',
  },
  name: {color: color.text, fontSize: type.caption},
  offline: {color: color.textMuted},
  host: {color: color.textMuted, fontSize: dp(20)},
});
