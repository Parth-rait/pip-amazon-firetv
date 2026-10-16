import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {AVATAR_COLORS} from '../shared/protocol';
import {color} from '../theme';

/** A player's avatar: their initial on the color they picked (PROJECT.md 2.4). */
export function Avatar({
  name,
  avatar,
  size,
  isAway = false,
}: {
  name: string;
  avatar: number;
  size: number;
  isAway?: boolean;
}) {
  const initial = [...name.trim()][0]?.toLocaleUpperCase() ?? '?';
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: AVATAR_COLORS[avatar] ?? AVATAR_COLORS[0],
        },
        isAway && styles.away,
      ]}>
      <Text style={[styles.initial, {fontSize: size * 0.44}]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {alignItems: 'center', justifyContent: 'center'},
  away: {opacity: 0.35},
  initial: {color: color.bg, fontWeight: '700'},
});
