import HapticPressable from './HapticPressable';
import {
  useMemo } from 'react';
import { Image,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { ChevronRight } from 'lucide-react-native';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';

const REFLECTION_ICON = require('../assets/png/home/reflection.png');

type DailyThoughtCardProps = {
  onReflect: (text: string) => void;
  isCompact?: boolean;
};

// Gentle, grounding lines — supportive and non-clinical, never hustle-motivational
// or diagnostic. Keep the voice calm and uncertainty-aware.
const THOUGHTS = [
  'Rest counts as progress too.',
  "You don't have to have it figured out to begin.",
  'Notice one small thing that went okay today.',
  'Slow is still forward.',
  'Whatever you are feeling is allowed to be here.',
  'You can start again, gently, at any point in the day.',
  'A hard day is not the whole story.',
  'Small and honest beats big and forced.',
  'It is okay to let today be enough.',
  'You are allowed to change your mind.',
  'One kind sentence to yourself can shift the day.',
  'Showing up quietly still counts as showing up.',
  'Not everything needs a solution right now.',
  'You have made it through every day so far.',
  'Give yourself the patience you would offer a friend.',
];

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

const pickTodaysThought = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / 86400000,
  );

  return THOUGHTS[dayOfYear % THOUGHTS.length];
};

export default function DailyThoughtCard({
  onReflect,
  isCompact = false,
}: DailyThoughtCardProps) {
  const theme = useTheme();
  const thought = useMemo(pickTodaysThought, []);

  const handlePress = () => {
    triggerHaptic('optionSelected').catch(() => undefined);
    onReflect(thought);
  };

  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityLabel="Reflect on today's thought"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: hexToRgba(theme.colors.primary, 0.2),
          backgroundColor: hexToRgba(theme.colors.primary, 0.06),
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.labelRow}>
        <Image source={REFLECTION_ICON} style={styles.labelIcon} />
        <Text style={[styles.label, { color: theme.colors.mutedForeground }]}>
          Today's reflection
        </Text>
      </View>

      <Text
        style={[
          styles.thought,
          { color: theme.colors.foreground },
          isCompact && styles.thoughtCompact,
        ]}
      >
        {thought}
      </Text>

      <View style={styles.reflectRow}>
        <Text style={[styles.reflectText, { color: theme.colors.primary }]}>
          Reflect on this
        </Text>
        <ChevronRight size={16} color={theme.colors.primary} />
      </View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  pressed: {
    opacity: 0.9,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  labelIcon: {
    height: 18,
    width: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  thought: {
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 27,
  },
  thoughtCompact: {
    fontSize: 17,
    lineHeight: 24,
  },
  reflectRow: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 2,
  },
  reflectText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
