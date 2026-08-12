import HapticPressable from './HapticPressable';
import {
  useCallback,
  useEffect,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { useTheme } from '../theme/provider';

export type NewEntryChoice = 'guided' | 'open_ended';

type NewEntryChoiceSheetProps = {
  visible: boolean;
  isGuidedLocked?: boolean;
  onSelect: (choice: NewEntryChoice) => void;
  onGuidedLockedPress?: () => void;
  onClose: () => void;
  onDismissComplete?: () => void;
};

const guidedEntryIcon = require('../assets/png/entry/icons8-yoga-48.png');
const openEndedEntryIcon = require('../assets/png/entry/icons8-journal-100.png');

export default function NewEntryChoiceSheet({
  visible,
  isGuidedLocked = false,
  onSelect,
  onGuidedLockedPress,
  onClose,
  onDismissComplete,
}: NewEntryChoiceSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const colors = theme.colors;
  const slide = useRef(new Animated.Value(0)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(false);
  const isClosingRef = useRef(false);
  const shouldNotifyDismissRef = useRef(false);
  const [isModalVisible, setIsModalVisible] = useState(visible);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);

  const notifyDismissComplete = useCallback(() => {
    if (!shouldNotifyDismissRef.current) {
      return;
    }

    shouldNotifyDismissRef.current = false;
    onDismissComplete?.();
  }, [onDismissComplete]);

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isActive) {
          setIsReduceMotionEnabled(enabled);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let entranceFrame: number | null = null;

    // The sheet drives its own transition instead of Modal's `slide`, because
    // that animates the whole modal — the dimmed scrim would ride up from the
    // bottom with the card instead of fading over the screen behind it.
    const animateSheet = (toVisible: boolean, onFinished?: () => void) => {
      if (isReduceMotionEnabled || typeof jest !== 'undefined') {
        slide.setValue(toVisible ? 1 : 0);
        scrimOpacity.setValue(toVisible ? 1 : 0);
        onFinished?.();
        return;
      }

      Animated.parallel([
        Animated.timing(slide, {
          toValue: toVisible ? 1 : 0,
          duration: toVisible ? 320 : 220,
          easing: toVisible
            ? Easing.out(Easing.cubic)
            : Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: toVisible ? 1 : 0,
          duration: toVisible ? 240 : 180,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onFinished?.();
        }
      });
    };

    if (visible && !wasVisibleRef.current) {
      setIsModalVisible(true);
      isClosingRef.current = false;
      slide.setValue(0);
      scrimOpacity.setValue(0);
      entranceFrame = requestAnimationFrame(() => animateSheet(true));
    }

    if (!visible && wasVisibleRef.current && !isClosingRef.current) {
      isClosingRef.current = true;
      animateSheet(false, () => {
        shouldNotifyDismissRef.current = true;
        // Keep Modal mounted while its native host dismisses. Unmounting here
        // removes the iOS onDismiss listener before it can notify the caller.
        setIsModalVisible(false);
        isClosingRef.current = false;

        // React Native only guarantees Modal.onDismiss on iOS. Other
        // platforms can notify on the frame after the modal is removed.
        if (Platform.OS !== 'ios') {
          requestAnimationFrame(notifyDismissComplete);
        }
      });
    }

    wasVisibleRef.current = visible;

    return () => {
      if (entranceFrame !== null) {
        cancelAnimationFrame(entranceFrame);
      }
    };
  }, [
    isReduceMotionEnabled,
    notifyDismissComplete,
    scrimOpacity,
    slide,
    visible,
  ]);

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="none"
      onDismiss={notifyDismissComplete}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.scrim, { opacity: scrimOpacity }]}
          testID="new-entry-choice-scrim"
        >
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 20,
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [340, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Start a new entry
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Choose how you want to reflect today.
          </Text>

          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel={
              isGuidedLocked
                ? 'Guided reflection, Pro locked'
                : 'Guided reflection'
            }
            onPress={() => {
              if (isGuidedLocked) {
                onGuidedLockedPress?.();
                return;
              }

              onSelect('guided');
            }}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.primary + '22' },
              ]}
            >
              <Image
                accessibilityIgnoresInvertColors
                source={guidedEntryIcon}
                style={styles.optionIcon}
              />
            </View>
            <View style={styles.optionText}>
              <View style={styles.optionTitleRow}>
                <Text
                  style={[styles.optionTitle, { color: colors.foreground }]}
                >
                  Guided reflection
                </Text>
                {isGuidedLocked ? (
                  <View
                    style={[
                      styles.proPill,
                      { backgroundColor: colors.primary + '1F' },
                    ]}
                  >
                    <Lock color={colors.primary} size={11} strokeWidth={2.5} />
                    <Text style={[styles.proPillText, { color: colors.primary }]}>
                      PRO
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.optionBody, { color: colors.mutedForeground }]}
              >
                A few questions, then it goes deeper with you like a reflective
                conversation.
              </Text>
            </View>
          </HapticPressable>

          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Open-ended entry"
            onPress={() => onSelect('open_ended')}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.mutedForeground + '22' },
              ]}
            >
              <Image
                accessibilityIgnoresInvertColors
                source={openEndedEntryIcon}
                style={styles.optionIcon}
              />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                Open-ended
              </Text>
              <Text
                style={[styles.optionBody, { color: colors.mutedForeground }]}
              >
                A blank page to write freely, in your own words.
              </Text>
            </View>
          </HapticPressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 42, 38, 0.32)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIcon: {
    height: 28,
    resizeMode: 'contain',
    width: 28,
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
  optionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  proPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  proPillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
});
