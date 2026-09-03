import HapticPressable from '../../components/HapticPressable';
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
  LayoutAnimation,
  Modal,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { ChevronRight, RefreshCw, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddWidgetDemoPhone from '../../components/AddWidgetDemoPhone';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import JournalLoader from '../../components/JournalLoader';
import WidgetPreviewCard from '../../components/WidgetPreviewCard';
import { triggerHaptic } from '../../services/hapticsService';
import {
  getWidgetManagementState,
  setWidgetEnabled,
} from '../../services/widgetService';
import {
  MOOD_WIDGET_KIND,
  QUICK_THOUGHT_WIDGET_KIND,
  STREAK_WIDGET_KIND,
  type WidgetKind,
  type WidgetStatus,
} from '../../services/widgetBridge';
import { useAppStore } from '../../store/appStore';
import { shouldClaimRowSwipe } from '../../utils/rowSwipeGesture';
import { ThemeTransitionOverlay, useTheme } from '../../theme/provider';
import { ProfileSectionLayout, SectionCard } from './ProfileSectionLayout';

type WidgetsScreenProps = {
  isPremium: boolean;
  onBack: () => void;
  onOpenPremium: () => void;
};

type WidgetDefinition = {
  kind: WidgetKind;
  title: string;
  sizes: string;
  premium: boolean;
};

const WIDGETS: WidgetDefinition[] = [
  {
    kind: STREAK_WIDGET_KIND,
    title: 'Streak',
    sizes: 'Small + Medium',
    premium: false,
  },
  {
    kind: MOOD_WIDGET_KIND,
    title: 'Mood Check-in',
    sizes: 'Medium',
    premium: true,
  },
  {
    kind: QUICK_THOUGHT_WIDGET_KIND,
    title: 'Quick Thought',
    sizes: 'Small',
    premium: true,
  },
];

const emptyStatus: WidgetStatus = {
  expiresAt: null,
  isAvailable: false,
  installedKinds: [],
  hasConfiguredSession: false,
  isInitialized: false,
  enabledKinds: [],
  hasPremiumAccess: false,
  updatedAt: null,
};

const REMOVE_ACTION_WIDTH = 96;
const LONG_PRESS_DELAY_MS = 450;
const PREMIUM_LOCK_ICON = require('../../assets/png/settings/icons8-lock-48.png');
const HOW_TO_WIDGET_ICON = require('../../assets/png/settings/icons8-how-quest-48.png');

function useReduceMotionPreference() {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (mounted) {
          setReduceMotionEnabled(enabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
}

function HowToAddWidgetSheet({
  visible,
  reduceMotionEnabled,
  onDismiss,
}: {
  visible: boolean;
  reduceMotionEnabled: boolean;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const transition = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(visible);
  const isMountedRef = useRef(visible);

  useEffect(() => {
    transition.stopAnimation();

    if (visible) {
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        setIsMounted(true);
      }
      transition.setValue(reduceMotionEnabled ? 1 : 0);
      if (!reduceMotionEnabled) {
        Animated.timing(transition, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    if (reduceMotionEnabled) {
      transition.setValue(0);
      isMountedRef.current = false;
      setIsMounted(false);
      return;
    }

    Animated.timing(transition, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        isMountedRef.current = false;
        setIsMounted(false);
      }
    });
  }, [reduceMotionEnabled, transition, visible]);

  useEffect(
    () => () => {
      transition.stopAnimation();
    },
    [transition],
  );

  if (!isMounted) {
    return null;
  }

  const dismiss = () => {
    triggerHaptic('back').catch(() => undefined);
    onDismiss();
  };

  // The sheet is bottom-anchored, so the walkthrough takes what is left of the
  // window rather than a fixed height that would overflow a small device.
  const demoHeight = Math.min(400, windowHeight * 0.48);

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
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.colors.foreground,
              opacity: transition.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.32],
              }),
            },
          ]}
        >
          <HapticPressable
            accessibilityLabel="Close widget instructions"
            accessibilityRole="button"
            onPress={dismiss}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.instructionSheet,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              paddingBottom: Math.max(insets.bottom, 20),
              transform: [
                {
                  translateY: transition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [360, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.sheetGrabber,
              { backgroundColor: theme.colors.border },
            ]}
          />
          <View style={styles.sheetHeader}>
            <Text
              style={[styles.sheetTitle, { color: theme.colors.foreground }]}
            >
              Add a widget
            </Text>
            <HapticPressable
              accessibilityLabel="Close widget instructions"
              accessibilityRole="button"
              onPress={dismiss}
              style={({ pressed }) => [
                styles.sheetCloseButton,
                { borderColor: theme.colors.border },
                pressed && styles.pressed,
              ]}
            >
              <X color={theme.colors.foreground} size={18} />
            </HapticPressable>
          </View>

          <View style={[styles.demoZone, { height: demoHeight }]}>
            <AddWidgetDemoPhone maxHeight={demoHeight} />
          </View>

          <Text
            style={[
              styles.instructionNote,
              { color: theme.colors.mutedForeground },
            ]}
          >
            iOS lists every Journal.IO widget type. Only active widgets show
            your data.
          </Text>
        </Animated.View>
        <ThemeTransitionOverlay />
      </View>
    </Modal>
  );
}

function ActiveWidgetCard({
  definition,
  isBusy,
  reduceMotionEnabled,
  onRemove,
  closeSignal,
}: {
  definition: WidgetDefinition;
  isBusy: boolean;
  reduceMotionEnabled: boolean;
  onRemove: () => void;
  /**
   * Bumped by the parent whenever the page scrolls, so an open remove tray does
   * not stay open behind content the user has scrolled past.
   */
  closeSignal?: number;
}) {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const gestureStartX = useRef(0);
  const isOpenRef = useRef(false);
  const busyRef = useRef(isBusy);
  const reduceMotionRef = useRef(reduceMotionEnabled);
  const removeRef = useRef(onRemove);
  const [isOpen, setIsOpen] = useState(false);

  busyRef.current = isBusy;
  reduceMotionRef.current = reduceMotionEnabled;
  removeRef.current = onRemove;

  const settleRow = (toValue: number) => {
    const nextIsOpen = toValue < 0;
    isOpenRef.current = nextIsOpen;
    setIsOpen(nextIsOpen);

    if (reduceMotionRef.current) {
      translateX.setValue(toValue);
      return;
    }

    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      speed: 24,
      bounciness: 0,
    }).start();
  };

  const settleRowRef = useRef(settleRow);
  settleRowRef.current = settleRow;

  useEffect(() => {
    if (closeSignal === undefined || !isOpenRef.current) {
      return;
    }

    settleRowRef.current(0);
  }, [closeSignal]);

  const handleRemove = () => {
    if (busyRef.current) {
      return;
    }
    settleRow(0);
    removeRef.current();
  };

  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        !busyRef.current && shouldClaimRowSwipe(gestureState),
      onPanResponderGrant: () => {
        translateX.stopAnimation(value => {
          gestureStartX.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const nextValue = Math.max(
          -REMOVE_ACTION_WIDTH,
          Math.min(0, gestureStartX.current + gestureState.dx),
        );
        translateX.setValue(nextValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        const projectedValue = gestureStartX.current + gestureState.dx;

        if (gestureState.vx > 0.25) {
          settleRow(0);
          return;
        }
        if (
          gestureState.vx < -0.25 ||
          projectedValue <= -REMOVE_ACTION_WIDTH * 0.42
        ) {
          settleRow(-REMOVE_ACTION_WIDTH);
          return;
        }
        settleRow(0);
      },
      onPanResponderTerminate: () => {
        settleRow(isOpenRef.current ? -REMOVE_ACTION_WIDTH : 0);
      },
    }),
  );

  useEffect(
    () => () => {
      translateX.stopAnimation();
    },
    [translateX],
  );

  return (
    <View
      style={[
        styles.swipeContainer,
        {
          backgroundColor: theme.colors.destructive,
          borderColor: theme.colors.primary + '59',
          shadowColor: theme.colors.foreground,
        },
      ]}
    >
      <View
        importantForAccessibility={isOpen ? 'yes' : 'no-hide-descendants'}
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={styles.removeActionShell}
      >
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${definition.title} widget`}
          accessibilityState={{ busy: isBusy, disabled: isBusy }}
          disabled={isBusy}
          onPress={handleRemove}
          style={({ pressed }) => [
            styles.swipeRemoveButton,
            pressed && styles.removePressed,
          ]}
        >
          <ButtonLoadingContent
            loading={isBusy}
            loaderColor={theme.colors.primaryForeground}
          >
            <View style={styles.removeActionContent}>
              <Trash2 size={18} color={theme.colors.primaryForeground} />
              <Text
                style={[
                  styles.removeActionText,
                  { color: theme.colors.primaryForeground },
                ]}
              >
                Remove
              </Text>
            </View>
          </ButtonLoadingContent>
        </HapticPressable>
      </View>

      <Animated.View
        accessible
        accessibilityActions={[
          {
            name: 'delete',
            label: `Remove ${definition.title} widget`,
          },
        ]}
        accessibilityHint="Swipe left to remove."
        accessibilityLabel={`${definition.title}, active widget, ${definition.sizes}`}
        accessibilityRole="button"
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'delete') {
            handleRemove();
          }
        }}
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <WidgetPreviewCard kind={definition.kind} />
        {isBusy ? (
          <View
            style={[
              styles.busyOverlay,
              { backgroundColor: theme.colors.card + 'D9' },
            ]}
          >
            <JournalLoader color={theme.colors.primary} />
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function AvailableWidgetCard({
  definition,
  isBusy,
  isLocked,
  onAdd,
  onOpenPremium,
}: {
  definition: WidgetDefinition;
  isBusy: boolean;
  isLocked: boolean;
  onAdd: () => void;
  onOpenPremium: () => void;
}) {
  const theme = useTheme();
  const handledLongPressRef = useRef(false);

  const handleActivation = () => {
    if (isBusy) {
      return;
    }
    if (isLocked) {
      triggerHaptic('optionSelected').catch(() => undefined);
      onOpenPremium();
      return;
    }
    onAdd();
  };

  return (
    <HapticPressable
      accessibilityActions={[
        {
          name: 'activate',
          label: isLocked
            ? `View Premium options for ${definition.title}`
            : `Add ${definition.title} widget`,
        },
      ]}
      accessibilityHint={
        isLocked
          ? 'Premium is required for this widget.'
          : 'Press and hold to add this widget to Active Widgets.'
      }
      accessibilityLabel={
        isLocked
          ? `${definition.title}, Premium widget`
          : `${definition.title}, available widget`
      }
      accessibilityRole="button"
      accessibilityState={{ busy: isBusy, disabled: isBusy }}
      delayLongPress={LONG_PRESS_DELAY_MS}
      disabled={isBusy}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'activate') {
          handleActivation();
        }
      }}
      onLongPress={() => {
        handledLongPressRef.current = true;
        handleActivation();
      }}
      onPress={() => {
        if (isLocked && !handledLongPressRef.current) {
          handleActivation();
        }
      }}
      onPressIn={() => {
        handledLongPressRef.current = false;
      }}
      style={({ pressed }) => [styles.availableCard, pressed && styles.pressed]}
    >
      <View
        pointerEvents="none"
        testID={
          isLocked ? `locked-widget-preview-${definition.kind}` : undefined
        }
        style={isLocked ? styles.lockedPreview : undefined}
      >
        <WidgetPreviewCard kind={definition.kind} />
      </View>

      {isLocked ? (
        <View
          pointerEvents="none"
          style={[
            styles.premiumOverlay,
            { backgroundColor: theme.colors.card + 'D9' },
          ]}
        >
          <View
            style={[
              styles.premiumPromptRow,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Image
              source={PREMIUM_LOCK_ICON}
              style={styles.premiumLockIcon}
              testID={`premium-lock-icon-${definition.kind}`}
            />
            <Text
              style={[styles.premiumPrompt, { color: theme.colors.foreground }]}
            >
              Purchase Premium to unlock
            </Text>
          </View>
        </View>
      ) : null}

      {isBusy ? (
        <View
          pointerEvents="none"
          style={[
            styles.busyOverlay,
            { backgroundColor: theme.colors.card + 'D9' },
          ]}
        >
          <JournalLoader color={theme.colors.primary} />
        </View>
      ) : null}
    </HapticPressable>
  );
}

export default function WidgetsScreen({
  isPremium,
  onBack,
  onOpenPremium,
}: WidgetsScreenProps) {
  const theme = useTheme();
  const userId = useAppStore(state => state.session?.user.userId ?? null);
  const reduceMotionEnabled = useReduceMotionPreference();
  const reduceMotionRef = useRef(reduceMotionEnabled);
  const [status, setStatus] = useState<WidgetStatus>(emptyStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKind, setBusyKind] = useState<WidgetKind | null>(null);
  // Bumped on scroll so an open remove tray closes itself.
  const [rowCloseSignal, setRowCloseSignal] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  reduceMotionRef.current = reduceMotionEnabled;

  const loadStatus = useCallback(async (animateTransition = false) => {
    setError(null);
    try {
      const nextStatus = await getWidgetManagementState();
      if (animateTransition && !reduceMotionRef.current) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setStatus(nextStatus);
    } catch {
      setError("We couldn't read your widget settings right now.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus().catch(() => undefined);
  }, [loadStatus]);

  const updateWidget = async (kind: WidgetKind, enabled: boolean) => {
    if (!userId) {
      setError('Sign in again to update your widgets.');
      return;
    }

    setBusyKind(kind);
    setError(null);
    triggerHaptic(enabled ? 'primaryAction' : 'secondaryAction').catch(
      () => undefined,
    );

    try {
      const result = await setWidgetEnabled({
        kind,
        enabled,
        userId,
        hasPremiumAccess: isPremium,
      });

      if (result === 'premium-required') {
        onOpenPremium();
        return;
      }

      await loadStatus(true);

      if (result === 'failed') {
        setError(
          enabled
            ? 'The widget was selected, but its connection could not be finished. Please try again.'
            : "We couldn't remove that widget right now.",
        );
        return;
      }

      if (result === 'unavailable') {
        setError('Home Screen widgets are available in the iOS app.');
      }
    } catch {
      setError(
        enabled
          ? 'The widget was selected, but its connection could not be finished. Please try again.'
          : "We couldn't remove that widget right now.",
      );
    } finally {
      setBusyKind(null);
    }
  };

  const activeWidgets = WIDGETS.filter(widget =>
    status.enabledKinds.includes(widget.kind),
  );
  const availableWidgets = WIDGETS.filter(
    widget => !status.enabledKinds.includes(widget.kind),
  );

  const handleListScroll = useCallback(() => {
    setRowCloseSignal(value => value + 1);
  }, []);

  return (
    <>
      <ProfileSectionLayout
        title="Widgets"
        onBack={onBack}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.content}>
          <View style={styles.sectionHeading}>
            <Text
              style={[styles.sectionTitle, { color: theme.colors.foreground }]}
            >
              Active widgets
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Swipe left to remove.
            </Text>
          </View>

          {isLoading ? (
            <SectionCard>
              <View style={styles.loadingState}>
                <JournalLoader color={theme.colors.primary} />
                <Text
                  style={[
                    styles.loadingText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Loading your widgets
                </Text>
              </View>
            </SectionCard>
          ) : activeWidgets.length === 0 ? (
            <SectionCard
              backgroundColor={theme.colors.accent}
              style={styles.emptyActiveState}
            >
              <Text
                testID="empty-active-widgets-title"
                style={[styles.emptyTitle, { color: theme.colors.foreground }]}
              >
                No active widgets
              </Text>
            </SectionCard>
          ) : (
            <View style={styles.activeList}>
              {activeWidgets.map(definition => (
                <ActiveWidgetCard
                  key={definition.kind}
                  definition={definition}
                  isBusy={busyKind === definition.kind}
                  reduceMotionEnabled={reduceMotionEnabled}
                  onRemove={() => updateWidget(definition.kind, false)}
                  closeSignal={rowCloseSignal}
                />
              ))}
            </View>
          )}

          {!isLoading ? (
            <>
              <View style={[styles.sectionHeading, styles.availableHeading]}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.foreground },
                  ]}
                >
                  All widgets
                </Text>
                <Text
                  style={[
                    styles.sectionDescription,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Press and hold to add.
                </Text>
              </View>

              {availableWidgets.length === 0 ? (
                <SectionCard backgroundColor={theme.colors.accent}>
                  <Text
                    style={[
                      styles.allActiveTitle,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    All widgets are active
                  </Text>
                </SectionCard>
              ) : (
                <View style={styles.availableList}>
                  {availableWidgets.map(definition => (
                    <AvailableWidgetCard
                      key={definition.kind}
                      definition={definition}
                      isBusy={busyKind === definition.kind}
                      isLocked={definition.premium && !isPremium}
                      onAdd={() => updateWidget(definition.kind, true)}
                      onOpenPremium={onOpenPremium}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}

          {error ? (
            <View
              accessibilityRole="alert"
              style={[
                styles.errorNotice,
                {
                  backgroundColor: theme.colors.destructive + '12',
                  borderColor: theme.colors.destructive + '40',
                },
              ]}
            >
              <Text
                style={[styles.errorText, { color: theme.colors.destructive }]}
              >
                {error}
              </Text>
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading widget settings"
                onPress={() => {
                  setIsLoading(true);
                  loadStatus().catch(() => undefined);
                }}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
              >
                <RefreshCw size={15} color={theme.colors.destructive} />
                <Text
                  style={[
                    styles.retryText,
                    { color: theme.colors.destructive },
                  ]}
                >
                  Retry
                </Text>
              </HapticPressable>
            </View>
          ) : null}

          <HapticPressable
            accessibilityHint="Plays a walkthrough of adding Journal.IO widgets to your Home Screen."
            accessibilityLabel="How to add a widget"
            accessibilityRole="button"
            onPress={() => {
              triggerHaptic('optionSelected').catch(() => undefined);
              setShowInstructions(true);
            }}
            style={({ pressed }) => [
              styles.howToCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.primary + '59',
                shadowColor: theme.colors.foreground,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.howToIcon}>
              <Image
                source={HOW_TO_WIDGET_ICON}
                style={styles.howToIconImage}
                testID="how-to-widget-icon"
              />
            </View>
            <Text
              style={[styles.howToTitle, { color: theme.colors.foreground }]}
            >
              How to add a widget
            </Text>
            <ChevronRight color={theme.colors.mutedForeground} size={18} />
          </HapticPressable>
        </View>
      </ProfileSectionLayout>
      <HowToAddWidgetSheet
        visible={showInstructions}
        reduceMotionEnabled={reduceMotionEnabled}
        onDismiss={() => setShowInstructions(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  sectionHeading: {
    gap: 4,
  },
  availableHeading: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  loadingState: {
    alignItems: 'center',
    gap: 10,
    minHeight: 120,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
  },
  emptyActiveState: {
    alignItems: 'center',
    minHeight: 84,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeList: {
    gap: 12,
  },
  swipeContainer: {
    borderWidth: 1.5,
    borderRadius: 22,
    elevation: 4,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  removeActionShell: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: REMOVE_ACTION_WIDTH,
  },
  swipeRemoveButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  removePressed: {
    opacity: 0.75,
  },
  removeActionContent: {
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  removeActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  availableList: {
    gap: 12,
  },
  availableCard: {
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  lockedPreview: {
    filter: [{ blur: 12 }],
    opacity: 0.42,
  },
  premiumOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  premiumPrompt: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  // A pill, not loose text: floating centred copy over a blurred preview read
  // as an error message rather than a lock.
  premiumPromptRow: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  premiumLockIcon: {
    height: 18,
    width: 18,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allActiveTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorNotice: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  howToCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  howToIcon: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  howToIconImage: {
    height: 28,
    width: 28,
  },
  howToTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  instructionSheet: {
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    gap: 20,
    maxWidth: 520,
    paddingHorizontal: 24,
    paddingTop: 10,
    width: '100%',
  },
  sheetGrabber: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    width: 42,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  sheetCloseButton: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  // Centred both ways: the phone frame fills this box, while the written-steps
  // fallback is intrinsically short and would otherwise hang from the top.
  demoZone: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionNote: {
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
});
