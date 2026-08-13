import HapticPressable from '../../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import {
  SafeAreaView } from 'react-native-safe-area-context';
import Svg,
  { Path } from 'react-native-svg';
import { Text,
} from '../../infrastructure/reactNative';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { triggerHaptic } from '../../services/hapticsService';
import { useTheme } from '../../theme/provider';

type Props = {
  displayName?: string;
  onSigned: (commitmentSignedAt: string) => void;
};

// Jitter floor: also caps how fast the path string grows over a stroke.
const MIN_POINT_DISTANCE = 1.6;
// A stray dot or a single tap must not unlock the commitment, so a signature
// has to be both long enough and wide enough to be a deliberate mark.
const MIN_INK_LENGTH = 140;
const MIN_INK_WIDTH = 48;
const COMMITMENT_DAYS = 30;
const EXIT_DURATION_MS = 160;
// Per character, not per word — the clause should read as someone typing it
// rather than as a response streaming in.
const TYPE_INTERVAL_MS = 18;
const CARET_BLINK_MS = 500;
// How long the caret keeps blinking after the last character before it leaves.
const CARET_HOLD_MS = 600;
const commitmentIcon = require('../../assets/png/onboarding/icons8-commitment-64.png');

const round = (value: number) => Math.round(value * 10) / 10;

type ClauseSegment = { text: string; accent?: boolean };

type ClauseTypewriterProps = {
  segments: ClauseSegment[];
  /** Start typing. Ignored when `instant` is set. */
  active: boolean;
  /** Reduce Motion: show the whole clause at once, with no caret. */
  instant: boolean;
  onComplete?: () => void;
};

/**
 * Types the commitment clause out one character at a time.
 *
 * Deliberately not `TypewriterText` from the guided reflection screen: that one
 * reveals whole words, which reads as a model streaming a reply, and it cannot
 * style a sub-span or carry a caret. Here the user's name stays accented while
 * the clause is only half written, so the text is typed as segments and each
 * one renders sliced against a single shared counter.
 */
function ClauseTypewriter({
  segments,
  active,
  instant,
  onComplete,
}: ClauseTypewriterProps) {
  const theme = useTheme();
  const onCompleteRef = useRef(onComplete);

  const offsets = useMemo(() => {
    let offset = 0;

    return segments.map(segment => {
      const start = offset;
      offset += segment.text.length;
      return { ...segment, start };
    });
  }, [segments]);

  const fullLength = useMemo(
    () => segments.reduce((total, segment) => total + segment.text.length, 0),
    [segments],
  );

  const [typedCount, setTypedCount] = useState(instant ? fullLength : 0);
  const [isCaretVisible, setIsCaretVisible] = useState(false);
  const [isCaretOn, setIsCaretOn] = useState(true);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (instant) {
      setTypedCount(fullLength);
      setIsCaretVisible(false);
      return;
    }

    if (!active) {
      setTypedCount(0);
      return;
    }

    setIsCaretVisible(true);

    let count = 0;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      count += 1;
      setTypedCount(count);

      if (count < fullLength) {
        return;
      }

      clearInterval(interval);
      onCompleteRef.current?.();
      // The clause is not editable, so the caret leaves rather than parking
      // there and implying it is.
      holdTimer = setTimeout(() => setIsCaretVisible(false), CARET_HOLD_MS);
    }, TYPE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (holdTimer) {
        clearTimeout(holdTimer);
      }
    };
  }, [active, fullLength, instant]);

  useEffect(() => {
    if (!isCaretVisible) {
      return;
    }

    setIsCaretOn(true);
    const blink = setInterval(
      () => setIsCaretOn(current => !current),
      CARET_BLINK_MS,
    );

    return () => clearInterval(blink);
  }, [isCaretVisible]);

  const caretColor = isCaretOn ? theme.colors.primary : 'transparent';

  return (
    <Text style={[styles.body, { color: theme.colors.foreground }]}>
      {offsets.map((segment, index) => {
        const visibleLength = Math.min(
          Math.max(typedCount - segment.start, 0),
          segment.text.length,
        );

        if (visibleLength <= 0) {
          return null;
        }

        const visible = segment.text.slice(0, visibleLength);

        return (
          <Text
            key={`clause-${index}`}
            style={
              segment.accent
                ? [styles.bodyName, { color: theme.colors.primary }]
                : undefined
            }
          >
            {visible}
          </Text>
        );
      })}
      {isCaretVisible ? (
        // Always rendered while visible and blinked via colour, so the glyph
        // never changes width and the clause cannot reflow mid-type.
        <Text style={{ color: caretColor }}>|</Text>
      ) : null}
    </Text>
  );
}

/**
 * Keeps an element mounted through its exit animation.
 *
 * A bare `visible ? <X /> : null` unmounts on the same frame the condition
 * flips, which is why clearing the pad used to make the sign action and the
 * Clear control disappear instantly instead of fading.
 */
const useRevealTransition = (visible: boolean, reduceMotion: boolean) => {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);

      if (reduceMotion) {
        progress.setValue(1);
        return;
      }

      // The conditional-action spring from the UI standards.
      const enter = Animated.spring(progress, {
        toValue: 1,
        damping: 16,
        stiffness: 220,
        mass: 0.85,
        useNativeDriver: true,
      });

      enter.start();

      return () => enter.stop();
    }

    if (reduceMotion) {
      progress.setValue(0);
      setIsMounted(false);
      return;
    }

    const exit = Animated.timing(progress, {
      toValue: 0,
      duration: EXIT_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });

    exit.start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });

    return () => exit.stop();
  }, [progress, reduceMotion, visible]);

  return { isMounted, progress };
};

const getFirstName = (displayName?: string) => {
  const trimmed = (displayName || '').trim();

  if (!trimmed) {
    return '';
  }

  return trimmed.split(/\s+/)[0];
};

export default function OnboardingCommitmentScreen({
  displayName,
  onSigned,
}: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  const [strokes, setStrokes] = useState<string[]>([]);
  const [activeStroke, setActiveStroke] = useState('');
  const [hasSigned, setHasSigned] = useState(false);
  const [isTypingActive, setIsTypingActive] = useState(false);

  // Top-down entrance: icon -> title -> typed clause -> stamp -> date -> pad.
  const iconAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const dateAnim = useRef(new Animated.Value(0)).current;
  const padAnim = useRef(new Animated.Value(0)).current;
  const iconShake = useRef(new Animated.Value(0)).current;
  const iconPop = useRef(new Animated.Value(0)).current;
  const stampRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasStampedRef = useRef(false);

  // The path string is appended to in a ref rather than rebuilt from a points
  // array — the pad emits ~60 events a second and rebuilding is O(n^2).
  const activeStrokeRef = useRef('');
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const inkLengthRef = useRef(0);
  const minXRef = useRef(Number.POSITIVE_INFINITY);
  const maxXRef = useRef(Number.NEGATIVE_INFINITY);
  const hasSignedRef = useRef(false);

  const firstName = getFirstName(displayName);
  const clauseSegments = useMemo<ClauseSegment[]>(() => {
    const tail = `commit to checking in with myself every day for the next ${COMMITMENT_DAYS} days.`;

    if (!firstName) {
      return [{ text: `I ${tail}` }];
    }

    return [
      { text: 'I, ' },
      { text: firstName, accent: true },
      { text: `, ${tail}` },
    ];
  }, [firstName]);
  const signedDate = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    [],
  );

  const panResponder = useRef(
    PanResponder.create({
      // Capture the touch so no ancestor can steal it and truncate a stroke.
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: event => {
        const { locationX, locationY } = event.nativeEvent;
        activeStrokeRef.current = `M ${round(locationX)} ${round(locationY)}`;
        lastPointRef.current = { x: locationX, y: locationY };
        minXRef.current = Math.min(minXRef.current, locationX);
        maxXRef.current = Math.max(maxXRef.current, locationX);
        setActiveStroke(activeStrokeRef.current);
      },

      onPanResponderMove: event => {
        const { locationX, locationY } = event.nativeEvent;
        const previous = lastPointRef.current;

        if (!previous) {
          return;
        }

        const distance = Math.hypot(
          locationX - previous.x,
          locationY - previous.y,
        );

        if (distance < MIN_POINT_DISTANCE) {
          return;
        }

        // Quadratic through the midpoint: the previous point is the control and
        // the midpoint the anchor, so the ink curves instead of reading as a
        // polyline.
        const midX = (previous.x + locationX) / 2;
        const midY = (previous.y + locationY) / 2;
        activeStrokeRef.current += ` Q ${round(previous.x)} ${round(
          previous.y,
        )} ${round(midX)} ${round(midY)}`;

        lastPointRef.current = { x: locationX, y: locationY };
        inkLengthRef.current += distance;
        minXRef.current = Math.min(minXRef.current, locationX);
        maxXRef.current = Math.max(maxXRef.current, locationX);
        setActiveStroke(activeStrokeRef.current);

        if (hasSignedRef.current) {
          return;
        }

        const inkWidth = maxXRef.current - minXRef.current;

        if (
          inkLengthRef.current < MIN_INK_LENGTH ||
          inkWidth < MIN_INK_WIDTH
        ) {
          return;
        }

        hasSignedRef.current = true;
        setHasSigned(true);
        // Drawing is a deliberate action, and the ref guard keeps this to one
        // cue per signature.
        triggerHaptic('optionSelected').catch(() => undefined);
      },

      onPanResponderRelease: () => {
        const stroke = activeStrokeRef.current;
        activeStrokeRef.current = '';
        lastPointRef.current = null;
        setActiveStroke('');

        if (stroke) {
          setStrokes(current => [...current, stroke]);
        }
      },

      onPanResponderTerminate: () => {
        const stroke = activeStrokeRef.current;
        activeStrokeRef.current = '';
        lastPointRef.current = null;
        setActiveStroke('');

        if (stroke) {
          setStrokes(current => [...current, stroke]);
        }
      },
    }),
  ).current;

  // Icon settles, then the title. The clause starts typing once both have
  // landed, so the eye is already in that region when it begins.
  useEffect(() => {
    const revealValues = [iconAnim, titleAnim, dateAnim, padAnim];

    if (reduceMotion) {
      revealValues.forEach(value => value.setValue(1));
      iconShake.setValue(0);
      iconPop.setValue(0);
      hasStampedRef.current = true;
      setIsTypingActive(false);
      return;
    }

    hasStampedRef.current = false;
    setIsTypingActive(false);
    revealValues.forEach(value => value.setValue(0));
    iconShake.setValue(0);
    iconPop.setValue(0);

    const entrance = Animated.sequence([
      Animated.delay(160),
      Animated.timing(iconAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    entrance.start(({ finished }) => {
      if (finished) {
        setIsTypingActive(true);
      }
    });

    return () => entrance.stop();
  }, [dateAnim, iconAnim, iconPop, iconShake, padAnim, reduceMotion, titleAnim]);

  useEffect(() => () => stampRef.current?.stop(), []);

  /**
   * Fires as the last character lands: the icon presses like a seal, then the
   * date and signing box follow.
   *
   * This is the screen's one flourish, and it sits here rather than on
   * signature completion because the clause is directly under the icon — at
   * signing time the user is looking at the pad with a finger over it, and that
   * moment already has its own haptic and the action springing in. No haptic
   * here; it is passive motion, not a user action.
   */
  const handleClauseComplete = useCallback(() => {
    if (hasStampedRef.current) {
      return;
    }

    hasStampedRef.current = true;

    const shakeLeg = (toValue: number, duration: number) =>
      Animated.timing(iconShake, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });

    stampRef.current = Animated.sequence([
      Animated.parallel([
        Animated.sequence([
          Animated.timing(iconPop, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(iconPop, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // Same asymmetric decay as the reminders bell, at a smaller angle so it
        // reads as a stamp rather than a wobble.
        Animated.sequence([
          shakeLeg(1, 80),
          shakeLeg(-1, 110),
          shakeLeg(0.65, 100),
          shakeLeg(0, 110),
        ]),
      ]),
      Animated.timing(dateAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(padAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    stampRef.current.start();
  }, [dateAnim, iconPop, iconShake, padAnim]);

  const handleClear = () => {
    triggerHaptic('secondaryAction').catch(() => undefined);
    activeStrokeRef.current = '';
    lastPointRef.current = null;
    inkLengthRef.current = 0;
    minXRef.current = Number.POSITIVE_INFINITY;
    maxXRef.current = Number.NEGATIVE_INFINITY;
    hasSignedRef.current = false;
    setStrokes([]);
    setActiveStroke('');
    setHasSigned(false);
  };

  const handleSign = () => {
    if (!hasSigned) {
      return;
    }

    triggerHaptic('primaryAction').catch(() => undefined);
    onSigned(new Date().toISOString());
  };

  const isPadEmpty = strokes.length === 0 && !activeStroke;
  // Both key off the same signature state, so clearing fades them out together.
  const ctaTransition = useRevealTransition(hasSigned, reduceMotion);
  const clearTransition = useRevealTransition(!isPadEmpty, reduceMotion);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.screen}>
        <View style={styles.document}>
          <Animated.View
            style={[
              styles.iconBadge,
              {
                backgroundColor: theme.colors.primary + '1F',
                opacity: iconAnim,
                transform: [
                  {
                    scale: Animated.multiply(
                      iconAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                      iconPop.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.08],
                      }),
                    ),
                  },
                  {
                    translateY: iconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                  {
                    rotate: iconShake.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: ['-9deg', '0deg', '9deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={commitmentIcon}
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
            My commitment
          </Animated.Text>

          <ClauseTypewriter
            active={isTypingActive}
            instant={reduceMotion}
            onComplete={handleClauseComplete}
            segments={clauseSegments}
          />

          <Animated.Text
            style={[
              styles.dated,
              {
                color: theme.colors.mutedForeground,
                opacity: dateAnim,
                transform: [
                  {
                    translateY: dateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            Dated {signedDate}
          </Animated.Text>
        </View>

        {/* Opacity only — the pad stays mounted so its PanResponder handles and
            testID survive the entrance. */}
        <Animated.View
          style={[
            styles.padSection,
            {
              opacity: padAnim,
              transform: [
                {
                  translateY: padAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            testID="commitment-signature-pad"
            style={[
              styles.pad,
              {
                backgroundColor: theme.colors.card,
                // The `border` token at hairline width is invisible against the
                // page on light themes (card #FFFFFF on background #FDFCFB), so
                // the signing area reads as a tinted frame instead.
                borderColor: theme.colors.primary + '59',
                shadowColor: theme.colors.foreground,
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
              {strokes.map((stroke, index) => (
                <Path
                  d={stroke}
                  fill="none"
                  key={`stroke-${index}`}
                  stroke={theme.colors.foreground}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                />
              ))}
              {activeStroke ? (
                <Path
                  d={activeStroke}
                  fill="none"
                  stroke={theme.colors.foreground}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                />
              ) : null}
            </Svg>

            {isPadEmpty ? (
              <View pointerEvents="none" style={styles.padHintWrap}>
                <Text
                  style={[
                    styles.padHint,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Sign here
                </Text>
              </View>
            ) : null}

            <View
              pointerEvents="none"
              style={[
                styles.padRule,
                { backgroundColor: theme.colors.primary + '66' },
              ]}
            />
          </View>

          <View style={styles.padFooter}>
            {clearTransition.isMounted ? (
              <Animated.View
                style={{
                  opacity: clearTransition.progress,
                  transform: [
                    {
                      translateY: clearTransition.progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [6, 0],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                }}
              >
                <HapticPressable
                  accessibilityLabel="Clear signature"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={handleClear}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text
                    style={[styles.clearText, { color: theme.colors.primary }]}
                  >
                    Clear
                  </Text>
                </HapticPressable>
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>

        <View style={styles.footer}>
          {ctaTransition.isMounted ? (
            <Animated.View
              style={{
                opacity: ctaTransition.progress,
                transform: [
                  {
                    translateY: ctaTransition.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    scale: ctaTransition.progress.interpolate({
                      inputRange: [0, 0.75, 1],
                      outputRange: [0.98, 1.035, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              }}
            >
              <HapticPressable
                accessibilityLabel="Sign my commitment"
                accessibilityRole="button"
                onPress={handleSign}
                style={({ pressed }) => [
                  styles.signButton,
                  { backgroundColor: theme.colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.signButtonText,
                    { color: theme.colors.primaryForeground },
                  ]}
                >
                  Sign my commitment
                </Text>
              </HapticPressable>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 17,
    lineHeight: 26,
    marginTop: 20,
    textAlign: 'center',
  },
  bodyName: {
    fontWeight: '600',
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dated: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  document: {
    alignItems: 'center',
    paddingTop: 8,
  },
  footer: {
    minHeight: 56,
    paddingBottom: 18,
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
    height: 32,
    width: 32,
  },
  pad: {
    borderRadius: 20,
    // Deliberately heavier than a hairline: see the borderColor note at the
    // call site.
    borderWidth: 1.5,
    elevation: 2,
    height: 180,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  padFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    minHeight: 18,
    paddingHorizontal: 4,
  },
  padHint: {
    fontSize: 13,
  },
  padHintWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padRule: {
    bottom: 36,
    height: 1,
    left: 24,
    position: 'absolute',
    right: 24,
  },
  padSection: {
    marginTop: 32,
  },
  pressed: {
    opacity: 0.9,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 30,
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  signButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 56,
  },
  signButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
    textAlign: 'center',
  },
});
