import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {ReactionKind} from '../shared/protocol';

// The four reaction faces, drawn like the pad's (a round face, no emoji).
export const REACTION_COLORS: Record<ReactionKind, string> = {
  laugh: '#FFD166',
  wow: '#6EC1FF',
  love: '#FF9BD2',
  scared: '#B8A6FF',
};

const INK = '#0B0B0F';

export function ReactionFace({kind, size}: {kind: ReactionKind; size: number}) {
  const u = size / 40;
  const happyEye = {
    width: 7 * u,
    height: 5 * u,
    borderTopWidth: 2.4 * u,
    borderColor: INK,
    borderTopLeftRadius: 6 * u,
    borderTopRightRadius: 6 * u,
  };
  const dotEye = {
    width: 5 * u,
    height: 5 * u,
    borderRadius: 5 * u,
    backgroundColor: INK,
  };
  const wideEye = {
    width: 8 * u,
    height: 8 * u,
    borderRadius: 8 * u,
    borderWidth: 1.6 * u,
    borderColor: INK,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View
      style={[
        styles.face,
        {
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: REACTION_COLORS[kind],
        },
      ]}>
      <View style={[styles.eyes, {gap: 6 * u, marginTop: 12 * u}]}>
        {[0, 1].map((i) =>
          kind === 'laugh' || kind === 'love' ? (
            <View key={i} style={happyEye} />
          ) : kind === 'wow' ? (
            <View key={i} style={dotEye} />
          ) : (
            <View key={i} style={wideEye}>
              <View
                style={{
                  width: 3 * u,
                  height: 3 * u,
                  borderRadius: 3 * u,
                  backgroundColor: INK,
                }}
              />
            </View>
          ),
        )}
      </View>
      <View style={[styles.mouth, {marginTop: 4 * u}]}>
        {kind === 'laugh' && (
          <View
            style={{
              width: 16 * u,
              height: 8 * u,
              borderBottomLeftRadius: 8 * u,
              borderBottomRightRadius: 8 * u,
              backgroundColor: INK,
            }}
          />
        )}
        {kind === 'wow' && (
          <View
            style={{
              width: 8 * u,
              height: 10 * u,
              borderRadius: 8 * u,
              backgroundColor: INK,
            }}
          />
        )}
        {kind === 'love' && (
          <Text style={[styles.heart, {fontSize: 12 * u, lineHeight: 13 * u}]}>
            {'♥'}
          </Text>
        )}
        {kind === 'scared' && (
          <View
            style={{
              width: 14 * u,
              height: 3 * u,
              borderRadius: 2 * u,
              backgroundColor: INK,
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {alignItems: 'center'},
  mouth: {alignItems: 'center'},
  heart: {color: '#E5384F'},
  eyes: {flexDirection: 'row', alignItems: 'center'},
});
