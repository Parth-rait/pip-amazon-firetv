import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import type {PipState} from '../shared/protocol';
import {color, dp, motionPipMs} from '../theme';

// Pip, a mint circle with two eyes, in the five states of PROJECT.md section 3.4.
// Every value is native-driven and animates only transform or opacity: RN 0.83 on Vega
// aborts when one view mixes native and JS drivers.

const HOP_DP = dp(24);

export function Pip({state, size = dp(120)}: {state: PipState; size?: number}) {
  const breathe = useRef(new Animated.Value(1)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.25)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  // Breathing: scale 1.00 to 1.04 over 2.4 s, slower while asleep.
  useEffect(() => {
    const half = (state === 'sleep' ? motionPipMs * 2 : motionPipMs) / 2;
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.04,
          duration: half,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: half,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, breathe]);

  // A blink every 4 to 6 s while awake and not thinking.
  useEffect(() => {
    if (state === 'sleep' || state === 'thinking') return;
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
    return () => clearTimeout(timer);
  }, [state, blink]);

  // Talking: a gentle bounce for 1.5 s. Cheer: two hops of 24 dp and a brighter glow.
  useEffect(() => {
    const hop = (height: number, ms: number) =>
      Animated.sequence([
        Animated.timing(lift, {
          toValue: -height,
          duration: ms * 0.4,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 0,
          duration: ms * 0.6,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
    let anim: Animated.CompositeAnimation | null = null;
    if (state === 'talking') {
      anim = Animated.sequence([0, 1, 2].map(() => hop(size * 0.08, 500)));
    } else if (state === 'cheer') {
      anim = Animated.parallel([
        Animated.sequence([hop(HOP_DP, 750), hop(HOP_DP, 750)]),
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 0.6,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.25,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ]);
    }
    anim?.start();
    return () => {
      anim?.stop();
      lift.setValue(0);
      glow.setValue(0.25);
    };
  }, [state, size, lift, glow]);

  // Thinking: three dots pulse one after another.
  useEffect(() => {
    if (state !== 'thinking') return;
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 600 - i * 200 + 400,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [state, dots]);

  const asleep = state === 'sleep';
  const eye = {
    width: size * 0.11,
    height: size * (asleep ? 0.05 : 0.26),
    borderRadius: size,
  };
  const look =
    state === 'thinking'
      ? [{translateX: size * 0.04}, {translateY: -size * 0.06}]
      : [];
  const dot = size * 0.07;

  return (
    <View
      style={[{width: size, height: size}, asleep && styles.asleep]}
      accessible
      accessibilityLabel={`Pip is ${state}`}>
      <Animated.View style={[styles.fill, {transform: [{translateY: lift}]}]}>
        {!asleep && (
          <Animated.View
            style={[
              styles.glow,
              {
                width: size * 1.3,
                height: size * 1.3,
                borderRadius: size,
                left: -size * 0.15,
                top: -size * 0.15,
                opacity: glow,
              },
            ]}
          />
        )}
        <Animated.View
          style={[
            styles.body,
            {borderRadius: size, transform: [{scale: breathe}]},
          ]}>
          <View style={[styles.eyes, {gap: size * 0.18, transform: look}]}>
            <Animated.View
              style={[styles.eye, eye, {transform: [{scaleY: blink}]}]}
            />
            <Animated.View
              style={[styles.eye, eye, {transform: [{scaleY: blink}]}]}
            />
          </View>
        </Animated.View>
      </Animated.View>
      {state === 'thinking' && (
        <View style={[styles.dots, {bottom: -size * 0.3, gap: dot * 0.8}]}>
          {dots.map((value, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {width: dot, height: dot, borderRadius: dot, opacity: value},
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  asleep: {opacity: 0.5},
  fill: {flex: 1},
  glow: {position: 'absolute', backgroundColor: color.accent},
  body: {
    flex: 1,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyes: {flexDirection: 'row', alignItems: 'center'},
  eye: {backgroundColor: color.bg},
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {backgroundColor: color.accent},
});
