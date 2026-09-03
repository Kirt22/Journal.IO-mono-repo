import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '../infrastructure/reactNative';
import { useTheme } from '../theme/provider';
import { fontFamilies } from '../theme/typography';

export type JournalWordmarkIntroResult = {
  animated: boolean;
  outcome: 'completed' | 'fallback' | 'reduced-motion';
};

type JournalWordmarkProps = {
  accessibilityLabel?: string;
  size?: 'default' | 'compact';
  playInkCurrentIntro?: boolean;
  onIntroStart?: () => void;
  onIntroMergeComplete?: (result: JournalWordmarkIntroResult) => void;
  onIntroComplete?: (result: JournalWordmarkIntroResult) => void;
};

const CURRENT_CLIMB_DURATION = 1120;
const CURRENT_MERGE_DELAY = 820;
const CURRENT_MERGE_DURATION = 540;
const FINAL_REVEAL_DELAY = 1030;
const FINAL_REVEAL_DURATION = 330;
const INK_SWEEP_DELAY = 1180;
const INK_SWEEP_DURATION = 260;
const MEASUREMENT_FALLBACK_DELAY = 180;
const INTRO_SAFETY_DELAY = 3600;
const BREATH_HALF_DURATION = 680;
const PATH_PROGRESS = [0, 0.16, 0.33, 0.5, 0.67, 0.84, 1];

export function getInkCurrentHorizontalPath(width: number) {
  const amplitude = Math.min(62, Math.max(38, width * 0.14));

  return [
    0,
    amplitude * 0.78,
    -amplitude,
    amplitude * 0.86,
    -amplitude * 0.58,
    amplitude * 0.22,
    0,
  ];
}

export function getInkCurrentVerticalPath(travelDistance: number) {
  return [
    travelDistance,
    travelDistance * 0.85,
    travelDistance * 0.68,
    travelDistance * 0.5,
    travelDistance * 0.32,
    travelDistance * 0.14,
    0,
  ];
}

export function getInkCurrentPresentationMetrics(width: number) {
  if (width < 360) {
    return {
      copyCount: 7,
      finalFontSize: 48,
      trailFontSize: 32,
      trailLineHeight: 35,
    };
  }

  if (width >= 430) {
    return {
      copyCount: 9,
      finalFontSize: 62,
      trailFontSize: 40,
      trailLineHeight: 43,
    };
  }

  return {
    copyCount: 8,
    finalFontSize: 56,
    trailFontSize: 36,
    trailLineHeight: 39,
  };
}

const COMPACT_PRESENTATION = {
  copyCount: 1,
  finalFontSize: 30,
  trailFontSize: 30,
  trailLineHeight: 33,
};

// The mark is set in Bricolage Grotesque Bold, whose tightest glyph pair in
// "journal.io" (the period against the i) leaves 0.066em of clearance. Tracking
// is held just inside that so the lockup stays tight without the glyphs
// touching, and `.io` runs marginally looser because it owns that tight pair.
//
// These are ratios rather than point values on purpose: the mark renders
// anywhere from 30px to 62px, and a single value tuned for 56px over-tightens
// to the point of collision at 30px.
const WORDMARK_TRACKING_RATIO = -0.04;
const IO_TRACKING_RATIO = -0.035;

const trackingFor = (fontSize: number, ratio = WORDMARK_TRACKING_RATIO) =>
  Math.round(fontSize * ratio * 10) / 10;

function getRowInputRange(index: number, copyCount: number) {
  const rowProgress = copyCount === 1 ? 0 : index / (copyCount - 1);
  const start = rowProgress * 0.12;
  const end = 0.78 + rowProgress * 0.22;

  return PATH_PROGRESS.map(point => start + point * (end - start));
}

export default function JournalWordmark({
  accessibilityLabel = 'Journal.IO',
  size = 'default',
  playInkCurrentIntro = false,
  onIntroStart,
  onIntroMergeComplete,
  onIntroComplete,
}: JournalWordmarkProps) {
  const theme = useTheme();
  const { height: screenHeight, width } = useWindowDimensions();
  const wordmarkRef = useRef<View>(null);
  const onIntroStartRef = useRef(onIntroStart);
  const onIntroMergeCompleteRef = useRef(onIntroMergeComplete);
  const onIntroCompleteRef = useRef(onIntroComplete);
  const hasStartedRef = useRef(false);
  const hasMergedRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const currentProgress = useRef(new Animated.Value(0)).current;
  const mergeProgress = useRef(new Animated.Value(0)).current;
  const finalReveal = useRef(
    new Animated.Value(playInkCurrentIntro ? 0 : 1),
  ).current;
  const inkSweepProgress = useRef(
    new Animated.Value(playInkCurrentIntro ? 0 : 1),
  ).current;
  const breathProgress = useRef(new Animated.Value(0)).current;
  const [motionPreferenceReady, setMotionPreferenceReady] = useState(
    !playInkCurrentIntro,
  );
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [travelDistance, setTravelDistance] = useState<number | null>(null);
  const [introComplete, setIntroComplete] = useState(!playInkCurrentIntro);
  const [shouldBreathe, setShouldBreathe] = useState(false);
  const presentation =
    size === 'compact'
      ? COMPACT_PRESENTATION
      : getInkCurrentPresentationMetrics(width);
  const wordmarkHeight = Math.round(presentation.finalFontSize * 1.08);
  const horizontalPath = getInkCurrentHorizontalPath(width);
  const verticalPath = getInkCurrentVerticalPath(
    travelDistance ?? screenHeight,
  );

  useEffect(() => {
    onIntroStartRef.current = onIntroStart;
  }, [onIntroStart]);

  useEffect(() => {
    onIntroMergeCompleteRef.current = onIntroMergeComplete;
  }, [onIntroMergeComplete]);

  useEffect(() => {
    onIntroCompleteRef.current = onIntroComplete;
  }, [onIntroComplete]);

  const reportMerge = useCallback((result: JournalWordmarkIntroResult) => {
    if (hasMergedRef.current) {
      return;
    }

    hasMergedRef.current = true;
    onIntroMergeCompleteRef.current?.(result);
  }, []);

  const completeIntro = useCallback(
    (
      animated: boolean,
      outcome: JournalWordmarkIntroResult['outcome'],
    ) => {
      if (hasCompletedRef.current) {
        return;
      }

      const result = { animated, outcome } as const;

      hasCompletedRef.current = true;
      currentProgress.setValue(1);
      mergeProgress.setValue(1);
      finalReveal.setValue(1);
      inkSweepProgress.setValue(1);
      setIntroComplete(true);
      setShouldBreathe(animated);
      reportMerge(result);
      onIntroCompleteRef.current?.(result);
    },
    [currentProgress, finalReveal, inkSweepProgress, mergeProgress, reportMerge],
  );

  useEffect(() => {
    if (!playInkCurrentIntro) {
      return;
    }

    let isActive = true;
    const updateReduceMotion = (enabled: boolean) => {
      if (!isActive) {
        return;
      }

      setReduceMotionEnabled(enabled);
      setMotionPreferenceReady(true);
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(updateReduceMotion)
      .catch(() => updateReduceMotion(false));

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      updateReduceMotion,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [playInkCurrentIntro]);

  useEffect(() => {
    if (!playInkCurrentIntro || travelDistance !== null) {
      return;
    }

    const fallback = setTimeout(() => {
      setTravelDistance(current => current ?? screenHeight + 48);
    }, MEASUREMENT_FALLBACK_DELAY);

    return () => clearTimeout(fallback);
  }, [playInkCurrentIntro, screenHeight, travelDistance]);

  useEffect(() => {
    if (!playInkCurrentIntro || introComplete) {
      return;
    }

    const safetyTimeout = setTimeout(
      () => completeIntro(false, 'fallback'),
      INTRO_SAFETY_DELAY,
    );

    return () => clearTimeout(safetyTimeout);
  }, [completeIntro, introComplete, playInkCurrentIntro]);

  useEffect(() => {
    if (
      !playInkCurrentIntro ||
      !motionPreferenceReady ||
      travelDistance === null ||
      introComplete
    ) {
      return;
    }

    if (reduceMotionEnabled) {
      completeIntro(false, 'reduced-motion');
      return;
    }

    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    currentProgress.setValue(0);
    mergeProgress.setValue(0);
    finalReveal.setValue(0);
    inkSweepProgress.setValue(0);
    onIntroStartRef.current?.();

    const mergeAnimation = Animated.sequence([
      Animated.delay(CURRENT_MERGE_DELAY),
      Animated.timing(mergeProgress, {
        toValue: 1,
        duration: CURRENT_MERGE_DURATION,
        easing: Easing.bezier(0.33, 0, 0.18, 1),
        useNativeDriver: true,
      }),
    ]);
    const entranceAnimation = Animated.parallel([
      Animated.timing(currentProgress, {
        toValue: 1,
        duration: CURRENT_CLIMB_DURATION,
        easing: Easing.bezier(0.2, 0.74, 0.18, 1),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(FINAL_REVEAL_DELAY),
        Animated.timing(finalReveal, {
          toValue: 1,
          duration: FINAL_REVEAL_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(INK_SWEEP_DELAY),
        Animated.timing(inkSweepProgress, {
          toValue: 1,
          duration: INK_SWEEP_DURATION,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    mergeAnimation.start(({ finished }) => {
      if (finished) {
        reportMerge({ animated: true, outcome: 'completed' });
      }
    });
    entranceAnimation.start(({ finished }) => {
      if (finished) {
        completeIntro(true, 'completed');
      }
    });

    return () => {
      mergeAnimation.stop();
      entranceAnimation.stop();
    };
  }, [
    completeIntro,
    currentProgress,
    finalReveal,
    inkSweepProgress,
    introComplete,
    mergeProgress,
    motionPreferenceReady,
    playInkCurrentIntro,
    reduceMotionEnabled,
    reportMerge,
    travelDistance,
  ]);

  useEffect(() => {
    if (!shouldBreathe || reduceMotionEnabled) {
      breathProgress.setValue(0);
      return;
    }

    const breathAnimation = Animated.sequence([
      Animated.timing(breathProgress, {
        toValue: 1,
        duration: BREATH_HALF_DURATION,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(breathProgress, {
        toValue: 0,
        duration: BREATH_HALF_DURATION,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]);

    breathAnimation.start();

    return () => breathAnimation.stop();
  }, [breathProgress, reduceMotionEnabled, shouldBreathe]);

  const handleLayout = useCallback(() => {
    if (!playInkCurrentIntro || hasStartedRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      wordmarkRef.current?.measureInWindow((_x, y) => {
        const measuredDistance = Math.max(
          screenHeight - y + 40,
          Math.round(screenHeight * 0.62),
        );
        setTravelDistance(current => current ?? measuredDistance);
      });
    });
  }, [playInkCurrentIntro, screenHeight]);

  const finalRevealStyle = {
    opacity: finalReveal,
    transform: [
      {
        translateY: finalReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [6, 0],
        }),
      },
      {
        scale: finalReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  } as const;
  const breathStyle = {
    transform: [
      {
        translateY: breathProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -2],
        }),
      },
    ],
  } as const;
  const ioColorRevealStyle = {
    opacity: inkSweepProgress.interpolate({
      inputRange: [0, 0.18, 1],
      outputRange: [0, 1, 1],
    }),
  } as const;
  const inkSweepStyle = {
    opacity: inkSweepProgress.interpolate({
      inputRange: [0, 0.14, 0.72, 1],
      outputRange: [0, 0.76, 0.42, 0],
    }),
    transform: [
      {
        translateX: inkSweepProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, presentation.finalFontSize * 1.12],
        }),
      },
    ],
  } as const;
  const shouldShowCurrent =
    playInkCurrentIntro &&
    motionPreferenceReady &&
    !reduceMotionEnabled &&
    !introComplete &&
    travelDistance !== null;

  return (
    <View
      ref={wordmarkRef}
      accessible
      accessibilityLabel={accessibilityLabel}
      onLayout={handleLayout}
      style={[styles.wordmark, { height: wordmarkHeight }]}
    >
      {shouldShowCurrent
        ? Array.from({ length: presentation.copyCount }, (_, index) => {
            const rowInputRange = getRowInputRange(
              index,
              presentation.copyCount,
            );
            const amplitudeFactor = 1 - index * 0.022;
            const rowOpacity = currentProgress.interpolate({
              inputRange: [
                rowInputRange[0],
                rowInputRange[1],
                rowInputRange[5],
                rowInputRange[6],
              ],
              outputRange: [0, 0.56 + index * 0.025, 0.82, 0.76],
              extrapolate: 'clamp',
            });
            const mergeOpacity = mergeProgress.interpolate({
              inputRange: [0, 0.58, 1],
              outputRange: [1, 0.84, 0],
            });
            const rowStyle = {
              opacity: Animated.multiply(rowOpacity, mergeOpacity),
              transform: [
                {
                  translateY: currentProgress.interpolate({
                    inputRange: rowInputRange,
                    outputRange: verticalPath,
                    extrapolate: 'clamp',
                  }),
                },
                {
                  translateX: currentProgress.interpolate({
                    inputRange: rowInputRange,
                    outputRange: horizontalPath.map(
                      position => position * amplitudeFactor,
                    ),
                    extrapolate: 'clamp',
                  }),
                },
                {
                  rotate: currentProgress.interpolate({
                    inputRange: rowInputRange,
                    outputRange: [
                      '0deg',
                      '1.2deg',
                      '-1.6deg',
                      '1.35deg',
                      '-0.9deg',
                      '0.35deg',
                      '0deg',
                    ],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  scale: currentProgress.interpolate({
                    inputRange: rowInputRange,
                    outputRange: [0.9, 0.94, 0.97, 0.99, 1, 1, 1],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            } as const;

            return (
              <Animated.Text
                key={index}
                accessible={false}
                allowFontScaling={false}
                testID={'journal-ink-copy-' + index}
                style={[
                  styles.currentLine,
                  {
                    color: theme.colors.foreground,
                    fontSize: presentation.trailFontSize,
                    letterSpacing: trackingFor(presentation.trailFontSize),
                    lineHeight: presentation.trailLineHeight,
                    top: Math.round(
                      (wordmarkHeight - presentation.trailLineHeight) / 2,
                    ),
                    zIndex: presentation.copyCount - index,
                  },
                  rowStyle,
                ]}
              >
                journal
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: fontFamilies.display.bold,
                  }}
                >
                  .io
                </Text>
              </Animated.Text>
            );
          })
        : null}

      <Animated.View style={[styles.finalMark, breathStyle]}>
        <Animated.View style={[styles.finalMark, finalRevealStyle]}>
          <View style={styles.finalTextRow}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.finalText,
                {
                  color: theme.colors.foreground,
                  fontSize: presentation.finalFontSize,
                  letterSpacing: trackingFor(presentation.finalFontSize),
                  lineHeight: wordmarkHeight,
                },
              ]}
            >
              journal
            </Text>
            <View
              testID="journal-wordmark-io-wrap"
              style={[
                styles.ioWrap,
                {
                  height: wordmarkHeight,
                  marginLeft: trackingFor(presentation.finalFontSize),
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.finalText,
                  {
                    color: theme.colors.foreground,
                    fontSize: presentation.finalFontSize,
                    letterSpacing: trackingFor(
                      presentation.finalFontSize,
                      IO_TRACKING_RATIO,
                    ),
                    lineHeight: wordmarkHeight,
                  },
                ]}
              >
                .io
              </Text>
              <Animated.Text
                accessible={false}
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.finalText,
                  styles.ioColorOverlay,
                  {
                    color: theme.colors.primary,
                    fontSize: presentation.finalFontSize,
                    letterSpacing: trackingFor(
                      presentation.finalFontSize,
                      IO_TRACKING_RATIO,
                    ),
                    lineHeight: wordmarkHeight,
                  },
                  ioColorRevealStyle,
                ]}
              >
                .io
              </Animated.Text>
              <View
                accessible={false}
                pointerEvents="none"
                testID="journal-wordmark-ink-sweep-clip"
                style={styles.inkSweepClip}
              >
                <Animated.View
                  style={[
                    styles.inkSweep,
                    { backgroundColor: theme.colors.primary },
                    inkSweepStyle,
                  ]}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    overflow: 'visible',
    paddingHorizontal: 8,
    width: '100%',
    zIndex: 2,
  },
  currentLine: {
    fontFamily: fontFamilies.display.bold,
    fontWeight: '700',
    includeFontPadding: false,
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
  finalMark: {
    width: '100%',
  },
  finalTextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  finalText: {
    fontFamily: fontFamilies.display.bold,
    fontWeight: '700',
    includeFontPadding: false,
    textAlign: 'center',
  },
  ioWrap: {
    justifyContent: 'center',
    overflow: 'visible',
    paddingRight: 4,
    position: 'relative',
  },
  // Deliberately unconstrained on the right. The coral `.io` is a raw
  // `Animated.Text`, so it does not pass through `infrastructure/reactNative`
  // and only carries the family this stylesheet gives it. Pinning `right: 0`
  // capped it at the width the layer underneath measured, and any metric
  // difference at all made `numberOfLines` truncate it to a period plus an
  // ellipsis — four coral dots across the mark. Sized to its own content it
  // cannot ellipsize, whatever the face.
  ioColorOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  inkSweepClip: {
    bottom: '20%',
    height: 4,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
  inkSweep: {
    borderRadius: 2,
    height: 2,
    width: 12,
  },
});
