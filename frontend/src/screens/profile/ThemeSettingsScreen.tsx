import HapticPressable from '../../components/HapticPressable';
import {
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { Check } from 'lucide-react-native';
import { useTheme, useThemeTransition } from '../../theme/provider';
import type { ThemePreference } from '../../theme/theme';
import { ProfileSectionLayout, SectionCard } from './ProfileSectionLayout';
import {
  getPersonalizationThemeOptions,
  type PersonalizationThemePreference,
} from './personalizationThemes';

type ThemeSettingsScreenProps = {
  currentThemePreference: PersonalizationThemePreference;
  onBack: () => void;
  onToggleTheme: (nextTheme: ThemePreference | null) => void;
};

export default function ThemeSettingsScreen({
  currentThemePreference,
  onBack,
  onToggleTheme,
}: ThemeSettingsScreenProps) {
  const theme = useTheme();
  const startThemeTransition = useThemeTransition();
  const themeOptions = getPersonalizationThemeOptions(theme.colors.primary);

  const handleSelectTheme = (
    nextPreference: PersonalizationThemePreference,
    event: GestureResponderEvent,
  ) => {
    if (nextPreference === currentThemePreference) {
      return;
    }

    const nextTheme = nextPreference === 'system' ? null : nextPreference;
    startThemeTransition({
      originX: event.nativeEvent.pageX,
      originY: event.nativeEvent.pageY,
      nextModeOverride: nextTheme,
    });
    onToggleTheme(nextTheme);
  };

  return (
    <ProfileSectionLayout title="Theme" onBack={onBack}>
      <SectionCard style={styles.optionsCard}>
        {themeOptions.map((option, index) => {
          const isSelected = option.value === currentThemePreference;

          return (
            <HapticPressable
              key={option.value}
              accessibilityLabel={`Use ${option.label} theme`}
              accessibilityRole="button"
              onPress={event => handleSelectTheme(option.value, event)}
              style={({ pressed }) => [
                styles.optionRow,
                index > 0 && {
                  borderTopColor: theme.colors.border,
                  borderTopWidth: 1,
                },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[styles.colorDot, { backgroundColor: option.color }]}
              />
              <View style={styles.optionCopy}>
                <Text
                  style={[
                    styles.optionLabel,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  {option.description}
                </Text>
              </View>
              {isSelected ? (
                <Check size={20} color={theme.colors.primary} />
              ) : null}
            </HapticPressable>
          );
        })}
      </SectionCard>
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  optionsCard: {
    paddingVertical: 0,
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    minHeight: 74,
    paddingHorizontal: 2,
  },
  colorDot: {
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});
