import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {PipState} from '../shared/protocol';
import {Pip} from '../components/Pip';
import {color, dp, space, type} from '../theme';

/**
 * A full-screen Pip with one line: "Connecting" before the first view, and for now the
 * quiz and results stages (their real screens come with the TV part of Step 9).
 */
export function StageScreen({pip, line}: {pip: PipState; line: string}) {
  return (
    <View style={styles.root}>
      <Pip state={pip} size={dp(200)} />
      <Text style={styles.line}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxxl,
    backgroundColor: color.bg,
  },
  line: {color: color.text, fontSize: type.title},
});
