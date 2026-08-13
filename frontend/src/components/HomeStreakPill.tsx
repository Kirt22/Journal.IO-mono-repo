import HapticPressable from './HapticPressable';
import {
  Image,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { useTheme } from '../theme/provider';

type HomeStreakPillProps = {
  currentStreak: number;
  isLoading: boolean;
  onPress: () => void;
};

const STREAK_FIRE_ICON = require('../assets/png/streaks/streak-fire.png');

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

/**
 * Replaces the old full-width streak card. Keeps the same primary-tinted
 * treatment and fire asset as the Streaks screen so the number reads as the same
 * thing in both places, and keeps the tap target that card used to provide.
 */
export default function HomeStreakPill({
  currentStreak,
  isLoading,
  onPress,
}: HomeStreakPillProps) {
  const theme = useTheme();

  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityLabel={
        isLoading
          ? 'Loading current streak'
          : `Current streak ${currentStreak} ${
              currentStreak === 1 ? 'day' : 'days'
            }. Open streak details`
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: hexToRgba(theme.colors.primary, 0.28),
          backgroundColor: hexToRgba(theme.colors.primary, 0.08),
        },
        pressed && styles.pressed,
      ]}
    >
      <Image source={STREAK_FIRE_ICON} style={styles.flameIcon} />

      {isLoading ? (
        // A placeholder rather than a 0, which would read as a real broken streak.
        <View
          style={[
            styles.countPlaceholder,
            { backgroundColor: hexToRgba(theme.colors.mutedForeground, 0.24) },
          ]}
        />
      ) : (
        <Text style={[styles.count, { color: theme.colors.foreground }]}>
          {currentStreak}
        </Text>
      )}
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 36,
    justifyContent: 'center',
    minWidth: 62,
    paddingHorizontal: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  flameIcon: {
    height: 18,
    resizeMode: 'contain',
    width: 18,
  },
  count: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  countPlaceholder: {
    borderRadius: 4,
    height: 10,
    width: 14,
  },
});
