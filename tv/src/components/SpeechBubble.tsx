import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {color, dp, radius, space, type} from '../theme';
import {Fade} from './Fade';

/**
 * Pip's speech bubble: an optional line above ("Leo asked: ..."), then the text, for `showMs`.
 * Give it a new key for each new message so the timer starts again.
 */
export function SpeechBubble({
  above,
  text,
  showMs,
  tint,
}: {
  above?: string;
  text: string;
  showMs: number;
  tint: string;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), showMs);
    return () => clearTimeout(t);
  }, [showMs]);
  return (
    <Fade visible={visible} style={styles.wrap}>
      {above ? (
        <Text style={styles.above} numberOfLines={1}>
          {above}
        </Text>
      ) : null}
      <View style={[styles.bubble, {borderColor: tint}]}>
        <Text style={styles.text} numberOfLines={4}>
          {text}
        </Text>
      </View>
    </Fade>
  );
}

const styles = StyleSheet.create({
  wrap: {maxWidth: dp(900), gap: space.s},
  above: {color: color.text, fontSize: type.caption},
  bubble: {
    paddingHorizontal: space.xl,
    paddingVertical: space.l,
    borderRadius: radius,
    borderBottomRightRadius: dp(6),
    borderWidth: dp(3),
    backgroundColor: color.surface,
  },
  text: {color: color.text, fontSize: type.body},
});
