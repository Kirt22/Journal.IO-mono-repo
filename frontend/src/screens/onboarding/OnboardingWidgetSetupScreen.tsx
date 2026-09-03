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
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingPulseOverlay, {
  resolvePulseGeometry,
  type PulseGeometry,
} from '../../components/OnboardingPulseOverlay';
import WidgetPreviewCard from '../../components/WidgetPreviewCard';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { triggerHaptic } from '../../services/hapticsService';
import { primeFreeTrialDays } from '../../services/revenueCatService';
import { STREAK_WIDGET_KIND } from '../../services/widgetBridge';
import { setWidgetEnabled } from '../../services/widgetService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import { fontFamilies } from '../../theme/typography';

type Props = {
  onActivated: (didEnableWidget: boolean) => void;
};

// Matches the long-press delay used by the Settings widget list so the gesture
// feels the same in both places.
const LONG_PRESS_DELAY_MS = 450;
const PULSE_DURATION_MS = 460;
const widgetsIcon = require('../../assets/png/onboarding/icons8-color-widgets-48.png');

export default function OnboardingWidgetSetupScreen({ onActivated }: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const userId = useAppStore(state => state.session?.user.userId ?? null);
  const isPremium = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );

  const [isIntroReady, setIsIntroReady] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isScreenReaderOn, setIsScreenReaderOn] = useState(false);
  const [pulseGeometry, setPulseGeometry] = useState<PulseGeometry | null>(null);
  // Mirrored into a spacer below the widget so its midpoint lands on the
  // screen's midpoint instead of the midpoint of the space under the header.
  const [headerHeight, setHeaderHeight] = useState(0);

  const iconAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const idlePulse = useRef(new Animated.Value(0)).current;
  const holdScale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const idleLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const activationRef = useRef<Animated.CompositeAnimation | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<View>(null);
  const cardCenterRef = useRef<{ x: number; y: number } | null>(null);
  // Whichever `setWidgetEnabled` result has landed by the time we advance. The
  // call is never awaited, so this can still be false on a slow network.
  const didEnableRef = useRef(false);
  const hasStartedRef = useRef(false);
  const hasAdvancedRef = useRef(false);

  const advance = useCallback(() => {
    if (hasAdvancedRef.current) {
      return;
    }

    hasAdvancedRef.current = true;
    onActivated(didEnableRef.current);
  }, [onActivated]);

  useEffect(() => {
    // Warm the trial length here so the timeline step a few screens later can
    // render its day numbers settled instead of swapping them in late.
    primeFreeTrialDays(userId);
  }, [userId]);

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isScreenReaderEnabled()
      .then(enabled => {
        if (isActive) {
          setIsScreenReaderOn(enabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderOn,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  const stopIdleLoop = useCallback(() => {
    idleLoopRef.current?.stop();
    idleLoopRef.current = null;
    Animated.timing(idlePulse, {
      toValue: 0,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [idlePulse]);

  // Entrance: icon -> title -> widget -> hint, matching the reminders step.
  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    let isActive = true;
    let entrance: Animated.CompositeAnimation | null = null;

    const startIdleLoop = () => {
      idleLoopRef.current?.stop();
      idlePulse.setValue(0);
      idleLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(idlePulse, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(idlePulse, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(400),
        ]),
      );
      idleLoopRef.current.start();
    };

    const reveal = (value: Animated.Value, duration: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    if (reduceMotion || isScreenReaderOn) {
      [iconAnim, titleAnim, cardAnim, hintAnim].forEach(value =>
        value.setValue(1),
      );
      idlePulse.setValue(0);
      setIsIntroReady(true);
      return;
    }

    setIsIntroReady(false);
    [iconAnim, titleAnim, cardAnim, hintAnim].forEach(value =>
      value.setValue(0),
    );

    entrance = Animated.sequence([
      Animated.delay(160),
      reveal(iconAnim, 460),
      reveal(titleAnim, 420),
      reveal(cardAnim, 480),
      reveal(hintAnim, 420),
    ]);

    entrance.start(({ finished }) => {
      if (finished && isActive) {
        setIsIntroReady(true);
        startIdleLoop();
      }
    });

    return () => {
      isActive = false;
      entrance?.stop();
      idleLoopRef.current?.stop();
    };
  }, [
    cardAnim,
    hintAnim,
    iconAnim,
    idlePulse,
    isScreenReaderOn,
    reduceMotion,
    titleAnim,
  ]);

  // Driven off geometry state so the overlay is mounted before progress moves.
  useEffect(() => {
    if (!pulseGeometry) {
      return;
    }

    pulse.setValue(0);
    const animation = Animated.timing(pulse, {
      toValue: 1,
      duration: PULSE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished) {
        advance();
      }
    });

    return () => animation.stop();
  }, [advance, pulse, pulseGeometry]);

  useEffect(
    () => () => {
      activationRef.current?.stop();
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    },
    [],
  );

  const enableStreakWidget = useCallback(() => {
    if (!userId) {
      return;
    }

    // Never awaited: for the streak kind this reconciles against two live
    // streak reads, and the choreography must not wait on the network.
    setWidgetEnabled({
      kind: STREAK_WIDGET_KIND,
      enabled: true,
      userId,
      hasPremiumAccess: isPremium,
    })
      .then(result => {
        didEnableRef.current = result === 'enabled';
      })
      .catch(() => undefined);
  }, [isPremium, userId]);

  const runActivation = useCallback(
    (origin: { x: number; y: number }) => {
      if (hasStartedRef.current) {
        return;
      }

      hasStartedRef.current = true;
      setIsActivating(true);
      stopIdleLoop();
      triggerHaptic('primaryAction').catch(() => undefined);
      enableStreakWidget();

      if (reduceMotion) {
        holdScale.setValue(1);
        shake.setValue(0);
        advanceTimerRef.current = setTimeout(advance, 150);
        return;
      }

      const shakeLeg = (toValue: number, duration: number) =>
        Animated.timing(shake, {
          toValue,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        });

      activationRef.current = Animated.sequence([
        Animated.spring(holdScale, {
          toValue: 1.06,
          damping: 16,
          stiffness: 220,
          mass: 0.85,
          useNativeDriver: true,
        }),
        // Slow wobble first, then faster — the iOS Home Screen jiggle.
        shakeLeg(0.5, 150),
        shakeLeg(-0.5, 150),
        shakeLeg(0.5, 150),
        shakeLeg(-0.5, 150),
        shakeLeg(1, 70),
        shakeLeg(-1, 70),
        shakeLeg(1, 70),
        shakeLeg(-1, 70),
        shakeLeg(1, 70),
        shakeLeg(-1, 70),
        shakeLeg(1, 70),
        shakeLeg(-1, 70),
        Animated.timing(shake, {
          toValue: 0,
          duration: 90,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      activationRef.current.start(({ finished }) => {
        if (!finished) {
          return;
        }

        setPulseGeometry(
          resolvePulseGeometry(origin, windowWidth, windowHeight),
        );
      });
    },
    [
      advance,
      enableStreakWidget,
      holdScale,
      reduceMotion,
      shake,
      stopIdleLoop,
      windowHeight,
      windowWidth,
    ],
  );

  /** Feedback that a plain tap is not the gesture, without advancing. */
  const nudge = useCallback(() => {
    if (hasStartedRef.current || reduceMotion) {
      return;
    }

    Animated.sequence([
      Animated.timing(shake, {
        toValue: 0.4,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -0.4,
        duration: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, shake]);

  const measureCardCenter = () => {
    cardRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      cardCenterRef.current = {
        x: x + measuredWidth / 2,
        y: y + measuredHeight / 2,
      };
    });
  };

  const handleLongPress = (pageX: number, pageY: number) => {
    if (!isIntroReady && !reduceMotion && !isScreenReaderOn) {
      return;
    }

    runActivation({ x: pageX, y: pageY });
  };

  const handlePress = () => {
    if (!isScreenReaderOn) {
      nudge();
      return;
    }

    // VoiceOver cannot deliver a reliable long press, so a plain activation
    // stands in for it.
    const origin = cardCenterRef.current || {
      x: windowWidth / 2,
      y: windowHeight / 2,
    };
    runActivation(origin);
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.screen}>
        <View
          style={styles.header}
          onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          <Animated.View
            style={[
              styles.iconBadge,
              {
                backgroundColor: theme.colors.primary + '1F',
                opacity: iconAnim,
                transform: [
                  {
                    scale: iconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                  {
                    translateY: iconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={widgetsIcon}
              style={styles.iconImage}
            />
          </Animated.View>

          <Animated.Text
            style={[
              styles.title,
              {
                color: theme.colors.foreground,
                opacity: titleAnim,
                transform: [
                  {
                    translateY: titleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            Let&apos;s set your widgets up!
          </Animated.Text>
        </View>

        <View style={styles.centerZone}>
          <Animated.View
            style={[
              styles.cardWrap,
              {
                opacity: cardAnim,
                transform: [
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <HapticPressable
              accessibilityHint="Activates your streak widget"
              accessibilityLabel="Streak widget preview"
              accessibilityRole="button"
              accessibilityState={{ busy: isActivating }}
              delayLongPress={LONG_PRESS_DELAY_MS}
              disabled={isActivating}
              onLayout={measureCardCenter}
              onLongPress={event =>
                handleLongPress(
                  event.nativeEvent.pageX,
                  event.nativeEvent.pageY,
                )
              }
              onPress={handlePress}
              onPressIn={() => {
                if (hasStartedRef.current || reduceMotion) {
                  return;
                }

                Animated.timing(holdScale, {
                  toValue: 0.985,
                  duration: 140,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                // Once activation has begun the sequence owns the scale, and
                // lifting the finger must not cancel it — there is no continue
                // button to fall back on.
                if (hasStartedRef.current || reduceMotion) {
                  return;
                }

                Animated.timing(holdScale, {
                  toValue: 1,
                  duration: 140,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }).start();
              }}
            >
              <Animated.View
                ref={cardRef}
                style={{
                  transform: [
                    // Only ever scale — the preview's activity grid has a fixed
                    // width and collapses if the box itself is resized.
                    {
                      scale: Animated.multiply(
                        holdScale,
                        idlePulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.018],
                        }),
                      ),
                    },
                    {
                      rotate: shake.interpolate({
                        inputRange: [-1, 0, 1],
                        outputRange: ['-2deg', '0deg', '2deg'],
                      }),
                    },
                    {
                      translateX: shake.interpolate({
                        inputRange: [-1, 0, 1],
                        outputRange: [-6, 0, 6],
                      }),
                    },
                  ],
                }}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.halo,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: idlePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.1, 0.22],
                      }),
                      transform: [
                        {
                          scale: idlePulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.05],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <WidgetPreviewCard kind={STREAK_WIDGET_KIND} />
              </Animated.View>
            </HapticPressable>
          </Animated.View>

          <Animated.Text
            style={[
              styles.hint,
              {
                color: theme.colors.mutedForeground,
                opacity: hintAnim,
                transform: [
                  {
                    translateY: hintAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {isScreenReaderOn
              ? 'Tap the widget to add it'
              : 'Touch and hold the widget'}
          </Animated.Text>
        </View>

        {/* Balances the header so the widget's midpoint sits on the screen's
            midpoint rather than the midpoint of the space beneath the title. */}
        <View pointerEvents="none" style={{ height: headerHeight }} />
      </View>

      <OnboardingPulseOverlay geometry={pulseGeometry} progress={pulse} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    alignSelf: 'center',
    maxWidth: 340,
    width: '100%',
  },
  centerZone: {
    alignItems: 'center',
    flex: 1,
    gap: 20,
    justifyContent: 'center',
  },
  halo: {
    borderRadius: 26,
    bottom: -6,
    left: -6,
    position: 'absolute',
    right: -6,
    top: -6,
  },
  header: {
    alignItems: 'center',
  },
  hint: {
    fontFamily: fontFamilies.ui.semibold,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
  },
  iconBadge: {
    alignItems: 'center',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    marginBottom: 20,
    width: 56,
  },
  iconImage: {
    height: 30,
    width: 30,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingBottom: 30,
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  title: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
    textAlign: 'center',
  },
});
