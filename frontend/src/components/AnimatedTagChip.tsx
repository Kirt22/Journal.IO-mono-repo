import HapticPressable from './HapticPressable';
import {
  useEffect,
  useRef } from 'react';
import {
  Animated,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

type AnimatedTagChipProps = {
  label: string;
  onPress: () => void;
  selected: boolean;
  shouldAnimate: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * A quick-thought tag chip whose selection reads as motion instead of a snap.
 *
 * Shared by the Home quick-note card and the widget Quick Thought screen so the
 * two composers stay in step. `label` is deliberately not named
 * `accessibilityLabel`: tests look the chip up with the singular
 * `findByProps({ accessibilityLabel })`, which throws once the same prop sits on
 * both this wrapper and the Pressable it renders.
 */
export default function AnimatedTagChip({
  label,
  onPress,
  selected,
  shouldAnimate,
  style,
  textStyle,
}: AnimatedTagChipProps) {
  const theme = useTheme();
  const selectProgress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    const target = selected ? 1 : 0;

    if (!shouldAnimate) {
      selectProgress.setValue(target);
      return;
    }

    selectProgress.stopAnimation();
    const animation = Animated.spring(selectProgress, {
      toValue: target,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      // Colour interpolation cannot run on the native driver, and the scale
      // pop below rides the same value so the chip settles as one motion.
      useNativeDriver: false,
    });
    animation.start();

    return () => animation.stop();
  }, [selectProgress, selected, shouldAnimate]);

  const handlePress = () => {
    triggerHaptic('optionSelected').catch(() => undefined);
    onPress();
  };

  const borderColor = selectProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.primary],
  });
  const backgroundColor = selectProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.card, hexToRgba(theme.colors.primary, 0.1)],
  });
  const labelColor = selectProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.mutedForeground, theme.colors.primary],
  });
  // Clamped because the spring is underdamped and overshoots past 1; without
  // it the chip would follow the final segment downward and dip under 1.0.
  const scale = selectProgress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 1.06, 1],
    extrapolate: 'clamp',
  });

  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={handlePress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <Animated.View
        style={[
          styles.chip,
          style,
          { backgroundColor, borderColor, transform: [{ scale }] },
        ]}
      >
        <Animated.Text style={[styles.label, textStyle, { color: labelColor }]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.7,
  },
});
