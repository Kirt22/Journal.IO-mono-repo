import HapticPressable from '../../components/HapticPressable';
import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { SafeAreaView } from 'react-native-safe-area-context';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import type { GuidedReflectionSessionAnalysisResponse } from '../../services/guidedReflectionService';
import { triggerHaptic } from '../../services/hapticsService';
import { useTheme } from '../../theme/provider';
import { fontFamilies } from '../../theme/typography';

const lockIcon = require('../../assets/png/entry/lock.png');

type SessionAnalysisScreenProps = {
  analysis?: GuidedReflectionSessionAnalysisResponse | null;
  continueLabel?: string;
  isContinueLoading?: boolean;
  locked?: boolean;
  onContinue: () => void;
  onSecondary?: () => void;
  onUpgrade?: () => void;
};

const REVEAL_COUNT = 6;

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatLabel(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatPercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export default function SessionAnalysisScreen({
  analysis,
  continueLabel = 'Continue',
  isContinueLoading = false,
  locked = false,
  onContinue,
  onSecondary,
  onUpgrade,
}: SessionAnalysisScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const reveals = useRef(
    Array.from({ length: REVEAL_COUNT }, () => new Animated.Value(0)),
  ).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showAllCenters, setShowAllCenters] = useState(false);
  const lockScale = useRef(new Animated.Value(1)).current;
  const lockShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (active) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    reveals.forEach(value => value.setValue(reduceMotion ? 1 : 0));
    if (reduceMotion) {
      return undefined;
    }

    const animation = Animated.stagger(
      105,
      reveals.map(value =>
        Animated.timing(value, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, reveals]);

  // The lock is the only thing on the free screen that moves, so it carries the
  // whole arrival: it swells, settles, then shakes to read as "held shut".
  useEffect(() => {
    if (!locked || reduceMotion) {
      lockScale.setValue(1);
      lockShake.setValue(0);
      return undefined;
    }

    triggerHaptic('primaryAction').catch(() => undefined);

    const shakeLeg = (toValue: number) =>
      Animated.timing(lockShake, {
        toValue,
        duration: 60,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });

    const animation = Animated.sequence([
      Animated.timing(lockScale, {
        toValue: 1.18,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lockScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      shakeLeg(-1),
      shakeLeg(1),
      shakeLeg(-0.7),
      shakeLeg(0.7),
      shakeLeg(0),
    ]);

    // Timed to land with the shake rather than the swell it follows.
    const shakeHaptic = setTimeout(
      () => triggerHaptic('animationCue').catch(() => undefined),
      400,
    );

    animation.start();

    return () => {
      clearTimeout(shakeHaptic);
      animation.stop();
    };
  }, [locked, lockScale, lockShake, reduceMotion]);

  const maxWidth = Math.min(width - 40, 430);
  const topics = (
    analysis?.detectedTopics ||
    analysis?.topicsObserved ||
    []
  ).slice(0, 5);
  // Only an explicit `false` is a low-signal session — a missing flag means the
  // analysis predates the field, not that the entry was thin.
  const hasEnoughSignal = analysis?.hasEnoughSignal !== false;
  const brainSessionMap = analysis?.brainSessionMap;
  const dominantCenter = brainSessionMap?.dominantCenter;
  const centers = brainSessionMap?.centers || [];
  const visibleCenters = showAllCenters ? centers : centers.slice(0, 3);

  const revealStyle = (index: number) => ({
    opacity: reveals[index],
    transform: [
      {
        translateY: reveals[index].interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  });

  const toggleCenters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAllCenters(current => !current);
  };

  if (locked) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right', 'bottom']}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.lockedShell, { maxWidth }]}>
          <View style={styles.lockedContent}>
          <Text style={[styles.title, { color: theme.colors.foreground }]}>
            Session analysis
          </Text>
          <View
            accessibilityLabel="Obscured representative session analysis"
            style={[
              styles.lockedPreview,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {[0, 1, 2].map(index => (
              <View
                key={index}
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: withAlpha(theme.colors.primary, 0.07),
                    borderColor: withAlpha(theme.colors.primary, 0.13),
                    opacity: 0.42 - index * 0.06,
                  },
                ]}
              >
                <View
                  style={[
                    styles.previewLine,
                    {
                      backgroundColor: withAlpha(theme.colors.foreground, 0.14),
                    },
                  ]}
                />
                <View
                  style={[
                    styles.previewLine,
                    styles.previewLineShort,
                    {
                      backgroundColor: withAlpha(theme.colors.foreground, 0.09),
                    },
                  ]}
                />
              </View>
            ))}
            <View
              pointerEvents="none"
              style={[
                styles.lockedScrim,
                { backgroundColor: withAlpha(theme.colors.background, 0.76) },
              ]}
            />
            <View style={styles.lockIcon}>
              <Animated.Image
                accessibilityIgnoresInvertColors
                source={lockIcon}
                style={[
                  styles.lockImage,
                  {
                    transform: [
                      { scale: lockScale },
                      {
                        translateX: lockShake.interpolate({
                          inputRange: [-1, 1],
                          outputRange: [-7, 7],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
          </View>
          <Text
            style={[styles.lockedTitle, { color: theme.colors.foreground }]}
          >
            Your patterns are ready to unfold
          </Text>
          <Text
            style={[
              styles.lockedCaption,
              { color: theme.colors.mutedForeground },
            ]}
          >
            Premium reads back what this entry was about.
          </Text>
          </View>
          <View style={styles.lockedFooter}>
          <HapticPressable
            accessibilityLabel="Unlock my analysis"
            accessibilityRole="button"
            onPress={onUpgrade}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.primaryForeground },
              ]}
            >
              Unlock my analysis
            </Text>
          </HapticPressable>
          <HapticPressable
            accessibilityLabel="Not now"
            accessibilityRole="button"
            onPress={onSecondary}
            style={({ pressed }) => [
              styles.textButton,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.textButtonText,
                { color: theme.colors.foreground },
              ]}
            >
              Not now
            </Text>
          </HapticPressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        bounces={false}
        contentContainerStyle={[styles.content, { maxWidth }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          style={[
            styles.title,
            { color: theme.colors.foreground },
            revealStyle(0),
          ]}
        >
          Session analysis
        </Animated.Text>

        <Animated.View
          style={[
            styles.analysisCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: withAlpha(theme.colors.primary, 0.18),
            },
            revealStyle(1),
          ]}
        >
          <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
            {hasEnoughSignal ? 'SESSION ANALYSIS' : 'NOT ENOUGH DETAIL YET'}
          </Text>
          <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
            {hasEnoughSignal
              ? 'A quick read on today'
              : 'Not enough to read from yet'}
          </Text>
          <Text style={[styles.body, { color: theme.colors.mutedForeground }]}>
            {analysis?.analysis ||
              'Your entry is saved. As you keep writing, Journal.IO will help you notice patterns in your thoughts, mood, and habits.'}
          </Text>
          {analysis?.majorInsight ? (
            <Text
              style={[styles.majorInsight, { color: theme.colors.foreground }]}
            >
              {analysis.majorInsight}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View
          style={[
            styles.analysisCard,
            styles.centerFeatureCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: withAlpha(theme.colors.primary, 0.26),
            },
            revealStyle(2),
          ]}
        >
          <View style={styles.centerFeatureHeader}>
            <View style={styles.centerFeatureCopy}>
              <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
                MOST NOTICED CENTER
              </Text>
              <Text
                style={[styles.cardTitle, { color: theme.colors.foreground }]}
              >
                {dominantCenter?.productName || 'Self-Reflection & Identity'}
              </Text>
              <Text
                style={[
                  styles.centerRegionText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {dominantCenter?.brainRegion || 'Medial prefrontal network'}
              </Text>
            </View>
            <View
              style={[
                styles.signalPill,
                {
                  backgroundColor: withAlpha(theme.colors.primary, 0.11),
                  borderColor: withAlpha(theme.colors.primary, 0.24),
                },
              ]}
            >
              <Text
                style={[styles.signalText, { color: theme.colors.primary }]}
              >
                {formatPercent(dominantCenter?.score || 0)} signal
              </Text>
            </View>
          </View>
          <Text style={[styles.body, { color: theme.colors.mutedForeground }]}>
            {dominantCenter?.shortInsight ||
              brainSessionMap?.mostNoticedText ||
              'Your writing appears most focused on making sense of your own experience.'}
          </Text>
          {dominantCenter ? (
            <>
              <View style={styles.metricRow}>
                <Text
                  style={[
                    styles.metricText,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {formatPercent(dominantCenter.confidence)} confidence
                </Text>
                <Text
                  style={[
                    styles.metricText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  {dominantCenter.intensity} intensity
                </Text>
              </View>
              {dominantCenter.evidence.length ? (
                <View style={styles.evidenceRow}>
                  {dominantCenter.evidence.slice(0, 3).map(item => (
                    <View
                      key={item}
                      style={[
                        styles.evidenceChip,
                        {
                          backgroundColor: theme.colors.secondary,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.evidenceText,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </Animated.View>

        <Animated.View
          style={[
            styles.analysisCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: withAlpha(theme.colors.border, 0.84),
            },
            revealStyle(3),
          ]}
        >
          <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
            CENTER BREAKDOWN
          </Text>
          <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
            Your reflection map
          </Text>
          <Text
            style={[
              styles.breakdownIntro,
              { color: theme.colors.mutedForeground },
            ]}
          >
            The strongest signals are shown first.
          </Text>
          <View style={styles.breakdownList}>
            {visibleCenters.map(center => (
              <View
                key={center.id}
                style={[
                  styles.breakdownRow,
                  {
                    backgroundColor: theme.colors.secondary,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.breakdownHeader}>
                  <View style={styles.breakdownTitleWrap}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.breakdownName,
                        { color: theme.colors.foreground },
                      ]}
                    >
                      {center.productName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.breakdownRegion,
                        { color: theme.colors.mutedForeground },
                      ]}
                    >
                      {center.brainRegion}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.breakdownPercent,
                      {
                        color:
                          center.id === dominantCenter?.id
                            ? theme.colors.primary
                            : theme.colors.mutedForeground,
                      },
                    ]}
                  >
                    {formatPercent(center.score)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: withAlpha(theme.colors.border, 0.76) },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor:
                          center.id === dominantCenter?.id
                            ? theme.colors.primary
                            : theme.colors.mutedForeground,
                        width: `${Math.max(6, center.score * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
          {centers.length > 3 ? (
            <HapticPressable
              accessibilityLabel={showAllCenters ? 'Show less' : 'Show more'}
              accessibilityRole="button"
              onPress={toggleCenters}
              style={({ pressed }) => [
                styles.breakdownButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.breakdownButtonText,
                  { color: theme.colors.primary },
                ]}
              >
                {showAllCenters ? 'Show less' : 'Show more'}
              </Text>
            </HapticPressable>
          ) : null}
        </Animated.View>

        <Animated.View
          style={[
            styles.analysisCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: withAlpha(theme.colors.border, 0.84),
            },
            revealStyle(4),
          ]}
        >
          <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
            TOPICS DETECTED
          </Text>
          {topics.length === 0 ? (
            <Text
              style={[
                styles.topicEmpty,
                { color: theme.colors.mutedForeground },
              ]}
            >
              No clear topics stood out in this entry yet.
            </Text>
          ) : (
            <View style={styles.topicRow}>
              {topics.map(topic => (
                <View
                  key={topic}
                  style={[
                    styles.topicChip,
                    {
                      backgroundColor: theme.colors.secondary,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.topicChipText,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {formatLabel(topic)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.tail, revealStyle(5)]}>
          <Text
            style={[styles.mindMapTitle, { color: theme.colors.foreground }]}
          >
            Your Mind Map is slowly building.
          </Text>
          <Text
            style={[
              styles.mindMapSubtitle,
              { color: theme.colors.mutedForeground },
            ]}
          >
            Each reflection adds a new signal to your brain-inspired reflection
            map.
          </Text>
          <HapticPressable
            accessibilityLabel={
              isContinueLoading ? 'Preparing next step' : continueLabel
            }
            accessibilityRole="button"
            accessibilityState={{ busy: isContinueLoading }}
            disabled={isContinueLoading}
            onPress={onContinue}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.continueButton,
              { backgroundColor: theme.colors.primary },
              pressed && !isContinueLoading && styles.pressed,
            ]}
          >
            <ButtonLoadingContent
              loaderColor={theme.colors.primaryForeground}
              loading={isContinueLoading}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: theme.colors.primaryForeground },
                ]}
              >
                {continueLabel}
              </Text>
            </ButtonLoadingContent>
          </HapticPressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    width: '100%',
  },
  title: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.55,
    lineHeight: 34,
    marginTop: 20,
    width: '100%',
  },
  analysisCard: {
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
    width: '100%',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 10,
  },
  body: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  majorInsight: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    width: '100%',
  },
  centerFeatureCard: { paddingTop: 17 },
  centerFeatureHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  centerFeatureCopy: { flex: 1, paddingRight: 10 },
  centerRegionText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  signalPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  signalText: { fontSize: 11, fontWeight: '600' },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  metricText: { fontSize: 12, fontWeight: '600' },
  evidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },
  evidenceChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  evidenceText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  breakdownIntro: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  breakdownList: { gap: 9, marginTop: 16 },
  breakdownRow: {
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  breakdownHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  breakdownTitleWrap: { flex: 1 },
  breakdownName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 17,
  },
  breakdownRegion: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 2,
  },
  breakdownPercent: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  barTrack: {
    borderRadius: 999,
    height: 6,
    marginTop: 9,
    overflow: 'hidden',
    width: '100%',
  },
  barFill: { borderRadius: 999, height: '100%' },
  breakdownButton: {
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  breakdownButtonText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  topicRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  topicEmpty: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  topicChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  tail: { marginTop: 24 },
  mindMapTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'center',
  },
  mindMapSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  continueButton: { marginTop: 22 },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
    width: '100%',
  },
  primaryButtonText: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  lockedShell: {
    alignSelf: 'center',
    flex: 1,
    paddingHorizontal: 20,
    width: '100%',
  },
  // Content takes the free space and centres within it; the actions stay put at
  // the bottom regardless of how tall that content ends up.
  lockedContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  lockedFooter: {
    paddingBottom: 12,
    paddingTop: 8,
    width: '100%',
  },
  lockedPreview: {
    borderRadius: 26,
    borderWidth: 1,
    marginTop: 20,
    overflow: 'hidden',
    padding: 16,
    width: '100%',
  },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 5,
    padding: 14,
  },
  previewLine: { borderRadius: 999, height: 10, width: '84%' },
  previewLineShort: { marginTop: 10, width: '56%' },
  lockedScrim: { ...StyleSheet.absoluteFillObject },
  lockIcon: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  lockedTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 27,
    marginTop: 24,
    maxWidth: 340,
    textAlign: 'center',
  },
  lockedCaption: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
  },
  lockImage: {
    height: 44,
    resizeMode: 'contain',
    width: 44,
  },
  textButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 20,
  },
  textButtonText: { fontSize: 14, fontWeight: '700' },
});
