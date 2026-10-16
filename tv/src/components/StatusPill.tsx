import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {color, safe, space, type} from '../theme';

/** "Reconnecting" in the top right corner while the socket is down (PROJECT.md 4.10). */
export function StatusPill({connected}: {connected: boolean}) {
  if (connected) return null;
  return (
    <View style={styles.pill}>
      <View style={styles.dot} />
      <Text style={styles.text}>Reconnecting</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: safe.vertical,
    right: safe.horizontal,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.xl,
    paddingVertical: space.m,
    borderRadius: 999,
    backgroundColor: color.surface2,
  },
  dot: {
    width: space.m,
    height: space.m,
    borderRadius: space.m,
    backgroundColor: color.textMuted,
  },
  text: {color: color.text, fontSize: type.caption},
});
