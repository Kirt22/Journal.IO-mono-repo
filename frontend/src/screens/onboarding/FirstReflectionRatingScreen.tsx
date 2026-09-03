import HapticPressable from '../../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import { triggerHaptic } from '../../services/hapticsService';
import { requestAppRating } from '../../services/appRatingService';
import { useTheme } from '../../theme/provider';
import { fontFamilies } from '../../theme/typography';

type Props = {
  onContinue: () => void;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Chart geometry, in viewBox units. The SVG scales to the card width.
const VB_W = 300;
const VB_H = 132;
const PAD = { top: 16, right: 14, bottom: 18, left: 10 };
// A gentle upward trend (0 = bottom, 1 = top) — the app "growing" over time.
const GROWTH = [0.28, 0.24, 0.42, 0.37, 0.56, 0.66, 0.9];

type Point = { x: number; y: number };

const buildPoints = (): Point[] => {
  const innerW = VB_W - PAD.left - PAD.right;
  const innerH = VB_H - PAD.top - PAD.bottom;
  const step = innerW / (GROWTH.length - 1);
  return GROWTH.map((v, i) => ({
    x: PAD.left + step * i,
    y: PAD.top + (1 - v) * innerH,
  }));
};

// Catmull-Rom → cubic bezier for a smooth, premium curve.
const buildSmoothPath = (pts: Point[]): string => {
  if (pts.length < 2) {
    return '';
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
};

function GrowthGraph({
  drawProgress,
  pulse,
  lineColor,
  gridColor,
}: {
  drawProgress: Animated.Value;
  pulse: Animated.Value;
  lineColor: string;
  gridColor: string;
}) {
  const { points, lineD, areaD, dashLength, last } = useMemo(() => {
    const pts = buildPoints();
    const line = buildSmoothPath(pts);
    const bottomY = VB_H - PAD.bottom;
    const first = pts[0];
    const lastPt = pts[pts.length - 1];
    const area = `${line} L ${lastPt.x} ${bottomY} L ${first.x} ${bottomY} Z`;
    // Approximate curve length from the polyline (a little longer once smoothed).
    let poly = 0;
    for (let i = 1; i < pts.length; i += 1) {
      poly += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return {
      points: pts,
      lineD: line,
      areaD: area,
      dashLength: poly * 1.2,
      last: lastPt,
    };
  }, []);

  const strokeDashoffset = drawProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [dashLength, 0],
  });
  const areaOpacity = drawProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const endpointOpacity = drawProgress.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [0, 0, 1],
  });
  const haloRadius = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [5, 13],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });

  return (
    <Svg width="100%" height={VB_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <LinearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lineColor} stopOpacity={0.28} />
          <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* baseline */}
      <Path
        d={`M ${PAD.left} ${VB_H - PAD.bottom} L ${VB_W - PAD.right} ${
          VB_H - PAD.bottom
        }`}
        stroke={gridColor}
        strokeWidth={1}
        strokeDasharray="2 5"
        strokeLinecap="round"
      />

      {/* area fill grows in with the line */}
      <AnimatedPath d={areaD} fill="url(#growthFill)" opacity={areaOpacity} />

      {/* the self-drawing growth line */}
      <AnimatedPath
        d={lineD}
        stroke={lineColor}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={`${dashLength}, ${dashLength}`}
        strokeDashoffset={strokeDashoffset}
      />

      {/* quiet earlier points */}
      {points.slice(0, -1).map((p, i) => (
        <AnimatedCircle
          key={`pt-${i}`}
          cx={p.x}
          cy={p.y}
          r={2.4}
          fill={lineColor}
          opacity={areaOpacity}
        />
      ))}

      {/* the endpoint — "you", the newest bit of growth */}
      <AnimatedCircle
        cx={last.x}
        cy={last.y}
        r={haloRadius}
        fill={lineColor}
        opacity={haloOpacity}
      />
      <AnimatedCircle
        cx={last.x}
        cy={last.y}
        r={4.5}
        fill={lineColor}
        opacity={endpointOpacity}
      />
    </Svg>
  );
}

export default function FirstReflectionRatingScreen({ onContinue }: Props) {
  const theme = useTheme();
  const [isRating, setIsRating] = useState(false);
  const [hasRequestedReview, setHasRequestedReview] = useState(false);
  const [isIntroReady, setIsIntroReady] = useState(false);
  const titleAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const drawProgress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let isActive = true;
    let entrance: Animated.CompositeAnimation | null = null;
    let tail: Animated.CompositeAnimation | null = null;
    let draw: Animated.CompositeAnimation | null = null;
    let runtimeReduceMotionPreference: boolean | null = null;

    const startPulse = () => {
      pulseLoopRef.current?.stop();
      pulse.setValue(0);
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.delay(240),
        ]),
      );
      pulseLoopRef.current.start();
    };

    const reveal = (value: Animated.Value, duration: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    const settle = () => {
      entrance?.stop();
      tail?.stop();
      draw?.stop();
      pulseLoopRef.current?.stop();
      titleAnim.setValue(1);
      cardAnim.setValue(1);
      bodyAnim.setValue(1);
      footerAnim.setValue(1);
      drawProgress.setValue(1);
      pulse.setValue(0);
      setIsIntroReady(true);
    };

    const play = () => {
      if (!isActive) {
        return;
      }
      setIsIntroReady(false);
      titleAnim.setValue(0);
      cardAnim.setValue(0);
      bodyAnim.setValue(0);
      footerAnim.setValue(0);
      drawProgress.setValue(0);
      pulse.setValue(0);

      entrance = Animated.sequence([
        Animated.delay(150),
        reveal(titleAnim, 420),
        reveal(cardAnim, 460),
      ]);

      entrance.start(({ finished }) => {
        if (!finished || !isActive) {
          return;
        }
        // Card is in: draw the growth line while the rest reveals.
        draw = Animated.timing(drawProgress, {
          toValue: 1,
          duration: 1050,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
        draw.start(({ finished: drawn }) => {
          if (drawn && isActive) {
            startPulse();
          }
        });

        tail = Animated.sequence([
          reveal(bodyAnim, 380),
          reveal(footerAnim, 400),
        ]);
        tail.start(({ finished: tailDone }) => {
          if (tailDone && isActive) {
            setIsIntroReady(true);
          }
        });
      });
    };

    const handleReduceMotionChange = (enabled: boolean) => {
      runtimeReduceMotionPreference = enabled;
      if (enabled) {
        settle();
      } else {
        play();
      }
    };

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      handleReduceMotionChange,
    );

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!isActive) {
          return;
        }
        if (runtimeReduceMotionPreference ?? enabled) {
          settle();
        } else {
          play();
        }
      })
      .catch(play);

    return () => {
      isActive = false;
      subscription.remove();
      entrance?.stop();
      tail?.stop();
      draw?.stop();
      pulseLoopRef.current?.stop();
    };
  }, [bodyAnim, cardAnim, drawProgress, footerAnim, pulse, titleAnim]);

  const handleRate = useCallback(async () => {
    if (isRating || hasRequestedReview) {
      return;
    }
    setIsRating(true);
    triggerHaptic('primaryAction').catch(() => undefined);
    // A quick endpoint pop — "you added to the curve".
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();

    let result;
    try {
      result = await requestAppRating();
    } catch {
      result = { status: 'failed' as const };
    }
    setIsRating(false);

    // The native review prompt gives no "dismissed" callback and doesn't
    // background the app, so we must NOT navigate here — otherwise the prompt
    // lands on the next screen. Keep the user on this screen; once the prompt
    // was shown (or the App Store opened), switch the CTA to "Continue" so they
    // proceed only after they're done — whether they left a rating or not.
    if (result.status === 'requested' || result.status === 'opened') {
      setHasRequestedReview(true);
    } else {
      // Nothing could be shown (unavailable / failed) — no reason to wait.
      onContinue();
    }
  }, [hasRequestedReview, isRating, onContinue, pulse]);

  const handleProceed = useCallback(() => {
    triggerHaptic('primaryAction').catch(() => undefined);
    onContinue();
  }, [onContinue]);

  const handleSkip = useCallback(() => {
    if (isRating) {
      return;
    }
    triggerHaptic('secondaryAction').catch(() => undefined);
    onContinue();
  }, [isRating, onContinue]);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.screen}>
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
          How are you liking Journal.IO?
        </Animated.Text>

        <View style={styles.centerZone}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity: cardAnim,
                transform: [
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                  {
                    scale: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardEyebrow, { color: theme.colors.mutedForeground }]}>
                Growing with you
              </Text>
              <Text style={[styles.cardTag, { color: theme.colors.primary }]}>
                + you
              </Text>
            </View>
            <GrowthGraph
              drawProgress={drawProgress}
              pulse={pulse}
              lineColor={theme.colors.primary}
              gridColor={theme.colors.border}
            />
          </Animated.View>

          <Animated.Text
            style={[
              styles.body,
              {
                color: theme.colors.mutedForeground,
                opacity: bodyAnim,
                transform: [
                  {
                    translateY: bodyAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            We're a small team, growing with every reflection. Each bit of support
            helps us shape what comes next — be part of the change.
          </Animated.Text>
        </View>

        <Animated.View
          style={[
            styles.footer,
            {
              opacity: footerAnim,
              transform: [
                {
                  translateY: footerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <HapticPressable
            accessibilityLabel={hasRequestedReview ? 'Continue' : 'Rate Journal.IO'}
            accessibilityRole="button"
            accessibilityState={{ busy: isRating, disabled: !isIntroReady || isRating }}
            disabled={!isIntroReady || isRating}
            onPress={
              hasRequestedReview
                ? handleProceed
                : () => handleRate().catch(() => undefined)
            }
            style={({ pressed }) => [
              styles.rateButton,
              { backgroundColor: theme.colors.primary },
              (pressed || isRating) && styles.pressed,
            ]}
          >
            <ButtonLoadingContent
              loaderColor={theme.colors.primaryForeground}
              loading={isRating}
            >
              <Text
                style={[styles.rateButtonText, { color: theme.colors.primaryForeground }]}
              >
                {hasRequestedReview ? 'Continue' : 'Rate Journal.IO'}
              </Text>
            </ButtonLoadingContent>
          </HapticPressable>
          {hasRequestedReview ? null : (
            <HapticPressable
              accessibilityLabel="Maybe later"
              accessibilityRole="button"
              disabled={!isIntroReady || isRating}
              hitSlop={8}
              onPress={handleSkip}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={[styles.skipText, { color: theme.colors.mutedForeground }]}>
                Maybe later
              </Text>
            </HapticPressable>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fontFamilies.ui.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 22,
    maxWidth: 340,
    textAlign: 'center',
  },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    width: '100%',
  },
  cardEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  cardTag: {
    fontSize: 13,
    fontWeight: '600',
  },
  centerZone: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  footer: {
    gap: 16,
    paddingBottom: 18,
  },
  pressed: {
    opacity: 0.9,
  },
  rateButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 56,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 30,
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
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
