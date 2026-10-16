import React, {useEffect, useRef} from 'react';
import {Animated, type StyleProp, type ViewStyle} from 'react-native';
import {motionFastMs} from '../theme';

/** Fades its children in and out in 180 ms (native-driven opacity only). */
export function Fade({
  visible,
  style,
  children,
}: {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: motionFastMs,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);
  return <Animated.View style={[style, {opacity}]}>{children}</Animated.View>;
}
