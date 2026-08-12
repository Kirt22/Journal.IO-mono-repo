import HapticPressable from './HapticPressable';
import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ButtonLoadingContent from './ButtonLoadingContent';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';

export const ONBOARDING_REMINDER_TIME_OPTIONS = [
  { label: 'Morning', detail: '8:00 AM', value: '08:00' },
  { label: 'Midday', detail: '12:00 PM', value: '12:00' },
  { label: 'Evening', detail: '6:00 PM', value: '18:00' },
  { label: 'Night', detail: '8:00 PM', value: '20:00' },
] as const;

type Props = {
  isSaving: boolean;
  onDismiss: () => void;
  onSave: () => void;
  onSelectTime: (time: string) => void;
  selectedTime: string;
  visible: boolean;
};

export default function OnboardingReminderTimeSheet({
  isSaving,
  onDismiss,
  onSave,
  onSelectTime,
  selectedTime,
  visible,
}: Props) {
  const theme = useTheme();
  const [isMounted, setIsMounted] = useState(visible);
  const transition = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setIsMounted(true);
      transition.setValue(0);
      requestAnimationFrame(() => {
        Animated.timing(transition, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    if (!visible && wasVisibleRef.current && isMounted) {
      Animated.timing(transition, {
        toValue: 0,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsMounted(false);
        }
      });
    }

    wasVisibleRef.current = visible;
  }, [isMounted, transition, visible]);

  const dismiss = () => {
    if (isSaving) {
      return;
    }

    triggerHaptic('back').catch(() => undefined);
    onDismiss();
  };

  const selectTime = (time: string) => {
    if (time === selectedTime || isSaving) {
      return;
    }

    triggerHaptic('optionSelected').catch(() => undefined);
    onSelectTime(time);
  };

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      transparent
      visible={isMounted}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          style={[
            styles.scrim,
            {
              opacity: transition.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.38],
              }),
            },
          ]}
        >
          <HapticPressable
            accessibilityLabel="Close reminder time picker"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={dismiss}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              transform: [
                {
                  translateY: transition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [420, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.colors.foreground }]}>
              What time feels right?
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
              Your reminder stays private and can be changed anytime.
            </Text>
          </View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.options}>
              {ONBOARDING_REMINDER_TIME_OPTIONS.map(option => {
                const isSelected = option.value === selectedTime;

                return (
                  <HapticPressable
                    key={option.value}
                    accessibilityLabel={`${option.label}, ${option.detail}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    disabled={isSaving}
                    onPress={() => selectTime(option.value)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: isSelected
                          ? `${theme.colors.primary}14`
                          : theme.colors.accent,
                        borderColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View>
                      <Text
                        style={[styles.optionLabel, { color: theme.colors.foreground }]}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={[
                          styles.optionDetail,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        {option.detail}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View
                        style={[
                          styles.checkShell,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      >
                        <Check color={theme.colors.primaryForeground} size={13} />
                      </View>
                    ) : null}
                  </HapticPressable>
                );
              })}
            </View>

            <HapticPressable
              accessibilityLabel="Save reminder"
              accessibilityRole="button"
              accessibilityState={{ busy: isSaving, disabled: isSaving }}
              disabled={isSaving}
              onPress={onSave}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: theme.colors.primary },
                (pressed || isSaving) && styles.pressed,
              ]}
            >
              <ButtonLoadingContent
                loaderColor={theme.colors.primaryForeground}
                loading={isSaving}
              >
                <Text
                  style={[
                    styles.saveButtonText,
                    { color: theme.colors.primaryForeground },
                  ]}
                >
                  Save reminder
                </Text>
              </ButtonLoadingContent>
            </HapticPressable>
            <SafeAreaView edges={['bottom']} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  checkShell: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  grabber: {
    alignSelf: 'center',
    borderRadius: 2,
    height: 4,
    marginBottom: 20,
    width: 38,
  },
  headerCopy: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  option: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: 16,
  },
  optionDetail: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 2,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  options: {
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 24,
    minHeight: 56,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scrim: {
    backgroundColor: '#000000',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingTop: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.45,
    lineHeight: 29,
    marginBottom: 5,
    textAlign: 'center',
  },
});
