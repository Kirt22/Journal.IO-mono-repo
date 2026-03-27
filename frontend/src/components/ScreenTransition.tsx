import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type ScreenTransitionHostProps<T extends string> = {
  activeKey: T;
  renderContent: (key: T) => ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

const EXIT_DURATION_MS = 120;
const ENTER_DURATION_MS = 210;
const EXIT_TRANSLATE_Y = -6;
const ENTER_TRANSLATE_Y = 12;
const EXIT_SCALE = 0.985;
const ENTER_SCALE = 0.99;

export default function ScreenTransitionHost<T extends string>({
  activeKey,
  renderContent,
  containerStyle,
}: ScreenTransitionHostProps<T>) {
  const [displayKey, setDisplayKey] = useState(activeKey);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (activeKey === displayKey) {
      return;
    }

    animationRef.current?.stop();

    const exitAnimation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: EXIT_TRANSLATE_Y,
        duration: EXIT_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: EXIT_SCALE,
        duration: EXIT_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animationRef.current = exitAnimation;

    exitAnimation.start(({ finished }) => {
      if (!finished) {
        return;
      }

      setDisplayKey(activeKey);
      opacity.setValue(0);
      translateY.setValue(ENTER_TRANSLATE_Y);
      scale.setValue(ENTER_SCALE);

      animationRef.current = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: ENTER_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: ENTER_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: ENTER_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      animationRef.current.start();
    });

    return () => {
      exitAnimation.stop();
    };
  }, [activeKey, displayKey, opacity, scale, translateY]);

  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.View
        style={[
          styles.animatedSurface,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        {renderContent(displayKey)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedSurface: {
    flex: 1,
  },
});
