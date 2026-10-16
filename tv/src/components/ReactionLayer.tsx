import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {getSocket} from '../net/socket';
import type {ReactionKind} from '../shared/protocol';
import {dp, safe} from '../theme';
import {ReactionFace} from './ReactionFace';

const RISE_MS = 2200;
const MAX_FLOATS = 16;

interface Float {
  id: number;
  kind: ReactionKind;
  x: number; // 0 to 1 across the lane
}

/** Reactions from the pads float up beside Pip (native-driven transform and opacity only). */
export function ReactionLayer() {
  const [floats, setFloats] = useState<Float[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const s = getSocket();
    const onReact = ({kind}: {kind: ReactionKind}) => {
      nextId.current += 1;
      const id = nextId.current;
      setFloats((all) => [
        ...all.slice(-(MAX_FLOATS - 1)),
        {id, kind, x: Math.random()},
      ]);
    };
    s.on('pip:react', onReact);
    return () => {
      s.off('pip:react', onReact);
    };
  }, []);

  return (
    <View style={styles.lane} pointerEvents="none">
      {floats.map((f) => (
        <Rising
          key={f.id}
          float={f}
          onDone={() => setFloats((all) => all.filter((x) => x.id !== f.id))}
        />
      ))}
    </View>
  );
}

function Rising({float, onDone}: {float: Float; onDone: () => void}) {
  const rise = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: RISE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => doneRef.current());
  }, [rise]);
  return (
    <Animated.View
      style={[
        styles.float,
        {
          left: `${Math.round(float.x * 80)}%`,
          opacity: rise.interpolate({
            inputRange: [0, 0.7, 1],
            outputRange: [1, 1, 0],
          }),
          transform: [
            {
              translateY: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -dp(420)],
              }),
            },
            {
              scale: rise.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0.6, 1.1, 1],
              }),
            },
          ],
        },
      ]}>
      <ReactionFace kind={float.kind} size={dp(72)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lane: {
    position: 'absolute',
    right: safe.horizontal + dp(140),
    bottom: safe.vertical + dp(40),
    width: dp(360),
    height: dp(480),
  },
  float: {position: 'absolute', bottom: 0},
});
