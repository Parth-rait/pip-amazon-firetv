import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import {LIMITS} from '../shared/protocol';
import {color, dp, space, type} from '../theme';

/**
 * The question's time left: a bar that empties from the right and the seconds. `runKey` changes
 * for each new question, so the bar starts again from `secondsLeft`.
 */
export function CountdownBar({
  runKey,
  secondsLeft,
  accent,
}: {
  runKey: string;
  secondsLeft: number;
  accent: string;
}) {
  const fraction = useRef(new Animated.Value(1)).current;
  const [left, setLeft] = useState(secondsLeft);
  const secondsRef = useRef(secondsLeft);
  secondsRef.current = secondsLeft;

  useEffect(() => {
    const start = Date.now();
    const total = secondsRef.current;
    fraction.setValue(total / LIMITS.questionSeconds);
    const anim = Animated.timing(fraction, {
      toValue: 0,
      duration: total * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start();
    setLeft(total);
    const tick = setInterval(
      () =>
        setLeft(Math.max(0, Math.ceil(total - (Date.now() - start) / 1000))),
      250,
    );
    return () => {
      anim.stop();
      clearInterval(tick);
    };
  }, [runKey, fraction]);

  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {backgroundColor: accent, transform: [{scaleX: fraction}]},
          ]}
        />
      </View>
      <Text style={styles.seconds}>{left} s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: space.xl, flex: 1},
  track: {
    flex: 1,
    height: dp(12),
    borderRadius: dp(12),
    overflow: 'hidden',
    backgroundColor: color.surface2,
  },
  fill: {height: '100%', width: '100%', transformOrigin: 'left'},
  seconds: {
    color: color.text,
    fontSize: type.title,
    minWidth: dp(100),
    textAlign: 'right',
  },
});
