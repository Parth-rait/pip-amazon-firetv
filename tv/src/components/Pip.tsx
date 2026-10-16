import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import type {PipState} from '../shared/protocol';
import {color, dp} from '../theme';

// Pip, the same little screen buddy as on the pad (pad/src/components/Pip.tsx), drawn with Views
// on a 120 x 120 grid: a rounded body, a light face panel, big eyes, cheeks and a smile. It only
// bobs and blinks (docs/vnext/PLAN.md 3.1). Every animated value is native-driven and moves only
// transform or opacity, and no view mixes drivers: RN 0.83 on Vega aborts when one does.

const INK = '#101418';
const FACE = '#F2FFFA';
const SHADE = '#60B499'; // the body color, darker, for the antennas and the belt
const FOOT = '#1F2937';
const BOB_MS = 3200;

export function Pip({state, size = dp(120)}: {state: PipState; size?: number}) {
  const bob = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const think = useRef(new Animated.Value(0.3)).current;
  const u = size / 120;
  const asleep = state === 'sleep';

  // A slow bob, slower while asleep.
  useEffect(() => {
    const half = (asleep ? BOB_MS * 1.6 : BOB_MS) / 2;
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: half,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: half,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [asleep, bob]);

  // A blink every 4 to 6 s while the eyes are open.
  useEffect(() => {
    if (asleep || state === 'thinking' || state === 'cheer') return;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(blink, {
            toValue: 0.1,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.timing(blink, {
            toValue: 1,
            duration: 90,
            useNativeDriver: true,
          }),
        ]).start(next);
      }, 4000 + Math.random() * 2000);
    };
    next();
    return () => {
      clearTimeout(timer);
      blink.setValue(1);
    };
  }, [asleep, state, blink]);

  // Thinking: two bubbles above Pip's head pulse.
  useEffect(() => {
    if (state !== 'thinking') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(think, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(think, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, think]);

  /** A box on the 120 grid. */
  const box = (x: number, y: number, w: number, h: number, r = 0) => ({
    position: 'absolute' as const,
    left: x * u,
    top: y * u,
    width: w * u,
    height: h * u,
    borderRadius: r * u,
  });
  /** An arc: the bottom (a smile, closed eyes) or the top (happy eyes) of a ring. */
  const arc = (x: number, y: number, d: number, side: 'top' | 'bottom') => ({
    ...box(x, y, d, d, d / 2),
    borderWidth: 3.2 * u,
    borderColor: 'transparent',
    [side === 'top' ? 'borderTopColor' : 'borderBottomColor']: INK,
  });

  const lift = bob.interpolate({inputRange: [0, 1], outputRange: [0, -4 * u]});
  const shadowScale = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });
  const look =
    state === 'thinking' ? [{translateX: 3 * u}, {translateY: -3 * u}] : [];
  const eyesOpen = !asleep && state !== 'cheer';

  return (
    <View
      style={{width: size, height: size}}
      accessible
      accessibilityLabel={`Pip is ${state}`}>
      <Animated.View
        style={[
          box(30, 108, 60, 10, 5),
          styles.shadow,
          {transform: [{scaleX: shadowScale}]},
        ]}
      />
      <View style={[StyleSheet.absoluteFill, asleep && styles.asleep]}>
        <Animated.View
          style={[StyleSheet.absoluteFill, {transform: [{translateY: lift}]}]}>
          <View
            style={[
              box(41, 4, 4, 14, 2),
              styles.stick,
              {transform: [{rotate: '-36deg'}]},
            ]}
          />
          <View
            style={[
              box(75, 4, 4, 14, 2),
              styles.stick,
              {transform: [{rotate: '36deg'}]},
            ]}
          />
          <View style={[box(34, 0.5, 8, 8, 4), styles.shell]} />
          <View style={[box(78, 0.5, 8, 8, 4), styles.shell]} />
          <View style={[box(28, 93, 18, 9, 4.5), styles.foot]} />
          <View style={[box(74, 93, 18, 9, 4.5), styles.foot]} />
          <View style={[box(14, 15, 92, 82, 27), styles.shell]} />
          <View style={[box(22, 80, 76, 9, 4.5), styles.belt]} />
          <View style={[box(24, 27, 72, 47, 17), styles.face]} />

          {eyesOpen && (
            <Animated.View
              style={[
                box(41, 40.5, 38, 15),
                {transform: [...look, {scaleY: blink}]},
              ]}>
              {[0, 26].map((x) => (
                <View key={x} style={[box(x, 0, 12, 15, 6), styles.eye]}>
                  <View style={[box(6, 2.5, 4, 4, 2), styles.shine]} />
                </View>
              ))}
            </Animated.View>
          )}
          {asleep &&
            [41, 67].map((x) => (
              <View key={x} style={arc(x, 39, 12, 'bottom')} />
            ))}
          {state === 'cheer' &&
            [41, 67].map((x) => <View key={x} style={arc(x, 44, 12, 'top')} />)}

          <View style={[box(29.5, 56.5, 9, 9, 4.5), styles.cheek]} />
          <View style={[box(81.5, 56.5, 9, 9, 4.5), styles.cheek]} />
          {state === 'talking' ? (
            <View style={[box(56, 57.4, 8, 9.2, 4.6), styles.eye]} />
          ) : (
            !asleep && <View style={arc(52, 50, 16, 'bottom')} />
          )}
        </Animated.View>
      </View>
      {state === 'thinking' && (
        <Animated.View style={[StyleSheet.absoluteFill, {opacity: think}]}>
          <View style={[box(99.6, 14.6, 6.8, 6.8, 3.4), styles.thought]} />
          <View style={[box(106.6, 4.6, 8.8, 8.8, 4.4), styles.thought]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {backgroundColor: '#000000', opacity: 0.25},
  asleep: {opacity: 0.7},
  stick: {backgroundColor: SHADE},
  shell: {backgroundColor: color.accent},
  belt: {backgroundColor: SHADE},
  face: {backgroundColor: FACE},
  eye: {backgroundColor: INK},
  shine: {backgroundColor: '#FFFFFF'},
  cheek: {backgroundColor: 'rgba(251, 113, 133, 0.45)'},
  foot: {backgroundColor: FOOT},
  thought: {backgroundColor: color.textMuted},
});
