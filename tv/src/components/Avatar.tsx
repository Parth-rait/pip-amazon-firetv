import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {AVATAR_COLORS} from '../shared/protocol';
import {color} from '../theme';

/**
 * A player's avatar: a little Pip in the color they picked, with its own ears (PROJECT.md 2.4),
 * drawn like the pad's on a 40 x 40 grid. Each of the 8 colors has a different shape on top.
 */
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
  const u = size / 40;
  const fill = AVATAR_COLORS[avatar] ?? AVATAR_COLORS[0];
  const at = (
    left: number,
    top: number,
    width: number,
    height: number,
  ): ViewStyle => ({
    position: 'absolute',
    left: left * u,
    top: top * u,
    width: width * u,
    height: height * u,
  });
  const round = (x: number, y: number, r: number): ViewStyle => ({
    ...at(x - r, y - r, 2 * r, 2 * r),
    borderRadius: r * u,
    backgroundColor: fill,
  });
  const triangle = (
    left: number,
    top: number,
    half: number,
    height: number,
    deg: number,
  ): ViewStyle => ({
    position: 'absolute',
    left: left * u,
    top: top * u,
    width: 0,
    height: 0,
    borderLeftWidth: half * u,
    borderRightWidth: half * u,
    borderBottomWidth: height * u,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: fill,
    transform: [{rotate: `${deg}deg`}],
  });
  const bar = (x: number, deg: number): ViewStyle => ({
    ...at(x - 1.1, 1, 2.2, 7),
    borderRadius: u,
    backgroundColor: fill,
    transform: [{rotate: `${deg}deg`}],
  });

  const top: ViewStyle[] =
    avatar === 1
      ? [round(9, 11, 5), round(31, 11, 5)]
      : avatar === 2
      ? [triangle(6, 3, 4.5, 12, -20), triangle(25, 3, 4.5, 12, 20)]
      : avatar === 3
      ? [
          {
            ...at(10.8, -1, 6.4, 16),
            borderRadius: 3.2 * u,
            backgroundColor: fill,
          },
          {
            ...at(22.8, -1, 6.4, 16),
            borderRadius: 3.2 * u,
            backgroundColor: fill,
          },
        ]
      : avatar === 4
      ? [{...at(19, 3, 2, 6), backgroundColor: fill}, round(20, 2.8, 2.6)]
      : avatar === 5
      ? [
          {
            ...at(20, 1, 8, 5),
            borderTopLeftRadius: 5 * u,
            borderBottomRightRadius: 5 * u,
            backgroundColor: fill,
            transform: [{rotate: '-20deg'}],
          },
          {
            ...at(12, 2, 8, 5),
            borderTopRightRadius: 5 * u,
            borderBottomLeftRadius: 5 * u,
            backgroundColor: fill,
            transform: [{rotate: '20deg'}],
          },
        ]
      : avatar === 6
      ? [bar(16.5, -16), bar(20, 0), bar(23.5, 16)]
      : avatar === 7
      ? [
          triangle(10, 3, 3.5, 8, 0),
          triangle(16.5, 1, 3.5, 9, 0),
          triangle(23, 3, 3.5, 8, 0),
        ]
      : [];

  return (
    <View
      style={[{width: size, height: size}, isAway && styles.away]}
      accessible
      accessibilityLabel={name}>
      {top.map((style, i) => (
        <View key={i} style={style} />
      ))}
      <View style={round(20, 23, 15)} />
      <View
        style={[at(12.9, 18.8, 4.2, 6.4), styles.eye, {borderRadius: 2.1 * u}]}
      />
      <View
        style={[at(22.9, 18.8, 4.2, 6.4), styles.eye, {borderRadius: 2.1 * u}]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  away: {opacity: 0.35},
  eye: {backgroundColor: color.bg},
});
