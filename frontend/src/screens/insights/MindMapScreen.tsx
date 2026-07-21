import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Brain,
  ChevronUp,
  RefreshCw,
  RotateCcw,
} from 'lucide-react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import NativeMindMapView, {
  type NativeMindMapRegionPressEvent,
} from '../../features/brainMap3D/NativeMindMapView';
import {
  getBrainMapColors,
  withAlpha,
} from '../../features/brainMap3D/brainMapTheme';
import type { MindMapNativeRegion } from '../../features/brainMap3D/mindMapRegionTypes';
import type { BrainReflectionCenterId } from '../../services/guidedReflectionService';
import { MainAppStackParamList } from '../../navigation/navigation';
import {
  getInsightsMindMap,
  type InsightsMindMap,
  type InsightsMindMapRange,
  type InsightsMindMapReady,
} from '../../services/insightsService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';

type MindMapNavigation = NativeStackNavigationProp<MainAppStackParamList>;

type EducationalRegion = {
  id: BrainReflectionCenterId;
  label: string;
  subtitle: string;
  description: string;
};

const EDUCATIONAL_REGIONS: EducationalRegion[] = [
  {
    id: 'emotional_intensity',
    label: 'Emotional Intensity',
    subtitle: 'Amygdala',
    description:
      'A place to notice the emotional tone and intensity that can appear in reflection.',
  },
  {
    id: 'planning_self_control',
    label: 'Planning & Self-Control',
    subtitle: 'Prefrontal Cortex',
    description:
      'A place to explore preparation, decisions, and the small actions you want to take.',
  },
  {
    id: 'memory_meaning',
    label: 'Memory & Meaning',
    subtitle: 'Hippocampus',
    description:
      'A place to consider what past experiences or memories may mean to you.',
  },
  {
    id: 'body_inner_signals',
    label: 'Body & Inner Signals',
    subtitle: 'Insula',
    description:
      'A place to notice rest, energy, and other signals you choose to name in writing.',
  },
  {
    id: 'conflict_attention',
    label: 'Conflict & Attention',
    subtitle: 'Anterior Cingulate',
    description:
      'A place to reflect on competing demands, focus, and moments of friction.',
  },
  {
    id: 'motivation_reward',
    label: 'Motivation & Reward',
    subtitle: 'Ventral Striatum',
    description:
      'A place to explore what feels meaningful, satisfying, or hard to begin.',
  },
  {
    id: 'relationships_perspective',
    label: 'Relationships & Perspective',
    subtitle: 'Temporal-Parietal Junction',
    description:
      'A place to reflect on connection, other viewpoints, and support.',
  },
  {
    id: 'self_reflection_identity',
    label: 'Self-Reflection & Identity',
    subtitle: 'Default Mode Network',
    description:
      'A place to explore your values, inner story, and sense of self.',
  },
];

function formatSignalPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildNativeRegions(
  readyMap: InsightsMindMapReady | null,
): MindMapNativeRegion[] {
  if (!readyMap) {
    return [];
  }

  return readyMap.regions.map(region => ({
    id: region.id,
    label: region.productLabel,
    subtitle: region.brainRegionSubtitle,
    signalScore: region.signalScore,
    confidence: region.confidence,
    intensity: region.intensity,
    isStrongest: region.id === readyMap.strongestRegionId,
  }));
}

function buildEducationalNativeRegions(): MindMapNativeRegion[] {
  return EDUCATIONAL_REGIONS.map(region => ({
    id: region.id,
    label: region.label,
    subtitle: region.subtitle,
    // These fixed values only render a neutral learning model. They are not user signals.
    signalScore: 0.5,
    confidence: 0,
    intensity: 'moderate',
    isStrongest: false,
  }));
}

function maskEvidence(snippets: string[], hidePreviews: boolean) {
  if (!hidePreviews) {
    return snippets;
  }

  return snippets.map(() => 'Preview hidden by Privacy Mode.');
}

export default function MindMapScreen({
  showBackButton = true,
}: {
  showBackButton?: boolean;
}) {
  const navigation = useNavigation<MindMapNavigation>();
  const theme = useTheme();
  const colors = getBrainMapColors(theme);
  const insets = useSafeAreaInsets();
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );
  const isAiOptedIn = useAppStore(
    state => state.session?.user.aiOptIn !== false,
  );
  const hideJournalPreviews = useAppStore(state => state.hideJournalPreviews);
  const [range, setRange] = useState<InsightsMindMapRange>('all_time');
  const [mindMap, setMindMap] = useState<InsightsMindMap | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const isEducationalMode = !isPremiumUser || !isAiOptedIn;

  const loadMindMap = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextMindMap = await getInsightsMindMap(range);
      setMindMap(nextMindMap);

      if (nextMindMap.status === 'ready') {
        setSelectedRegionId(nextMindMap.strongestRegionId);
      } else {
        setSelectedRegionId(null);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'We could not load your Mind Map right now.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotionEnabled)
      .catch(() => setReduceMotionEnabled(false));
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled) {
      reveal.setValue(1);
      return;
    }

    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduceMotionEnabled, reveal, range]);

  useEffect(() => {
    if (isEducationalMode) {
      setIsLoading(false);
      setMindMap(null);
      setSelectedRegionId(EDUCATIONAL_REGIONS[0].id);
      return;
    }

    loadMindMap().catch(() => undefined);
  }, [isEducationalMode, loadMindMap]);

  const readyMap = mindMap?.status === 'ready' ? mindMap : null;
  const selectedRegion = useMemo(() => {
    if (!readyMap) {
      return null;
    }

    return (
      readyMap.regions.find(region => region.id === selectedRegionId) ||
      readyMap.regions[0] ||
      null
    );
  }, [readyMap, selectedRegionId]);
  const strongestRegion = readyMap?.regions[0] || null;
  const nativeRegions = useMemo(() => buildNativeRegions(readyMap), [readyMap]);
  const educationalNativeRegions = useMemo(
    () => buildEducationalNativeRegions(),
    [],
  );
  const educationalSelectedRegion = useMemo(
    () =>
      EDUCATIONAL_REGIONS.find(region => region.id === selectedRegionId) ||
      EDUCATIONAL_REGIONS[0],
    [selectedRegionId],
  );
  const sheetHeight = isExpanded ? 0.56 : 0.24;

  const renderEducationalSheet = () => (
    <>
      <View style={styles.sheetPreviewRow}>
        <View style={styles.sheetPreviewCopy}>
          <Text style={[styles.sheetEyebrow, { color: colors.muted }]}>
            Educational map
          </Text>
          <Text style={[styles.sheetHeadline, { color: colors.text }]}>
            Learn the eight reflection regions
          </Text>
          <Text style={[styles.sheetBody, { color: colors.muted }]}>
            This view is a guide to how Journal.IO organizes reflections. It
            does not show personal scores, activity, or inferred results.
          </Text>
        </View>
        <View
          style={[
            styles.educationalBadge,
            { backgroundColor: withAlpha(colors.nodeHot, 0.12) },
          ]}
        >
          <Brain color={colors.nodeHot} size={20} />
        </View>
      </View>

      {isExpanded ? (
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.regionDetailCard,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.08),
                borderColor: withAlpha(colors.nodeHot, 0.18),
              },
            ]}
          >
            <Text style={[styles.regionTitle, { color: colors.text }]}>
              {educationalSelectedRegion.label}
            </Text>
            <Text style={[styles.regionSubtitle, { color: colors.muted }]}>
              {educationalSelectedRegion.subtitle}
            </Text>
            <Text style={[styles.regionBody, { color: colors.muted }]}>
              {educationalSelectedRegion.description}
            </Text>
          </View>
          <Text style={[styles.disclaimerTitle, { color: colors.text }]}>
            Explore all regions
          </Text>
          {EDUCATIONAL_REGIONS.map(region => {
            const selected = region.id === educationalSelectedRegion.id;

            return (
              <Pressable
                key={region.id}
                accessibilityRole="button"
                accessibilityLabel={`Learn about ${region.label}`}
                onPress={() => setSelectedRegionId(region.id)}
                style={({ pressed }) => [
                  styles.regionButton,
                  {
                    backgroundColor: selected
                      ? withAlpha(colors.nodeHot, 0.12)
                      : withAlpha(colors.outline, 0.05),
                    borderColor: selected
                      ? withAlpha(colors.nodeHot, 0.22)
                      : withAlpha(colors.outline, 0.14),
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.regionButtonCopy}>
                  <Text
                    style={[styles.regionButtonTitle, { color: colors.text }]}
                  >
                    {region.label}
                  </Text>
                  <Text
                    style={[
                      styles.regionButtonSubtitle,
                      { color: colors.muted },
                    ]}
                  >
                    {region.subtitle}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Text style={[styles.disclaimerTitle, { color: colors.text }]}>
            Reflection signal, not a medical measure
          </Text>
          <Text style={[styles.disclaimerBody, { color: colors.muted }]}>
            This is an educational visualization, not a literal view of brain
            activity or a health assessment.
          </Text>
        </ScrollView>
      ) : null}
    </>
  );

  const renderStatusSheet = () => {
    if (isEducationalMode) {
      return renderEducationalSheet();
    }

    if (isLoading) {
      return (
        <View style={styles.sheetContent}>
          <ActivityIndicator color={colors.nodeHot} />
          <Text style={[styles.sheetHeadline, { color: colors.text }]}>
            Building your Mind Map
          </Text>
          <Text style={[styles.sheetBody, { color: colors.muted }]}>
            Pulling your latest writing patterns into the reflection map.
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetHeadline, { color: colors.text }]}>
            We could not load your Mind Map
          </Text>
          <Text style={[styles.sheetBody, { color: colors.muted }]}>
            {error}
          </Text>
          <Pressable
            accessibilityLabel="Retry Mind Map"
            onPress={() => loadMindMap().catch(() => undefined)}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.nodeHot,
              },
              pressed && styles.pressed,
            ]}
          >
            <RefreshCw color={colors.background} size={14} />
            <Text
              style={[styles.primaryButtonText, { color: colors.background }]}
            >
              Retry
            </Text>
          </Pressable>
        </View>
      );
    }

    if (!mindMap) {
      return null;
    }

    if (mindMap.status === 'building') {
      return (
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetEyebrow, { color: colors.muted }]}>
            {mindMap.period.label}
          </Text>
          <Text style={[styles.sheetHeadline, { color: colors.text }]}>
            {mindMap.summary.headline}
          </Text>
          <Text style={[styles.sheetBody, { color: colors.muted }]}>
            {mindMap.summary.narrative}
          </Text>
          <View style={styles.metricsRow}>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: withAlpha(colors.nodeHot, 0.08) },
              ]}
            >
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {mindMap.progress.activeDays}/
                {mindMap.progress.minimumActiveDays}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>
                active days
              </Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: withAlpha(colors.outline, 0.08) },
              ]}
            >
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {mindMap.progress.clearEntryCount}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>
                clear entries
              </Text>
            </View>
          </View>
          <Text style={[styles.disclaimerTitle, { color: colors.text }]}>
            {mindMap.disclaimer.title}
          </Text>
          <Text style={[styles.disclaimerBody, { color: colors.muted }]}>
            {mindMap.disclaimer.body}
          </Text>
        </View>
      );
    }

    if (mindMap.status === 'support_first') {
      return (
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetEyebrow, { color: colors.muted }]}>
            {mindMap.period.label}
          </Text>
          <Text style={[styles.sheetHeadline, { color: colors.text }]}>
            {mindMap.summary.headline}
          </Text>
          <Text style={[styles.sheetBody, { color: colors.muted }]}>
            {mindMap.support.headline}
          </Text>
          <Text style={[styles.supportText, { color: colors.text }]}>
            {mindMap.support.body}
          </Text>
          <Text style={[styles.disclaimerTitle, { color: colors.text }]}>
            {mindMap.disclaimer.title}
          </Text>
          <Text style={[styles.disclaimerBody, { color: colors.muted }]}>
            {mindMap.disclaimer.body}
          </Text>
        </View>
      );
    }

    if (!selectedRegion || !strongestRegion) {
      return null;
    }

    return (
      <>
        <View style={styles.sheetPreviewRow}>
          <View style={styles.sheetPreviewCopy}>
            <Text style={[styles.sheetEyebrow, { color: colors.muted }]}>
              Strongest signal
            </Text>
            <Text style={[styles.sheetHeadline, { color: colors.text }]}>
              {strongestRegion.productLabel}
            </Text>
            <Text style={[styles.sheetBody, { color: colors.muted }]}>
              {mindMap.summary.note}
            </Text>
          </View>
          <View
            style={[
              styles.signalBadge,
              { backgroundColor: withAlpha(colors.nodeHot, 0.14) },
            ]}
          >
            <Text style={[styles.signalBadgeText, { color: colors.text }]}>
              {formatSignalPercent(strongestRegion.signalScore)}
            </Text>
          </View>
        </View>

        {isExpanded ? (
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.regionDetailCard,
                {
                  backgroundColor: withAlpha(colors.nodeHot, 0.08),
                  borderColor: withAlpha(colors.nodeHot, 0.18),
                },
              ]}
            >
              <Text style={[styles.regionTitle, { color: colors.text }]}>
                {selectedRegion.productLabel}
              </Text>
              <Text style={[styles.regionSubtitle, { color: colors.muted }]}>
                {selectedRegion.brainRegionSubtitle}
              </Text>
              <Text style={[styles.regionBody, { color: colors.muted }]}>
                {selectedRegion.shortInsight}
              </Text>
              <View style={styles.metricsRow}>
                <View
                  style={[
                    styles.metricCard,
                    { backgroundColor: withAlpha(colors.nodeHot, 0.08) },
                  ]}
                >
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {formatSignalPercent(selectedRegion.signalScore)}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>
                    signal
                  </Text>
                </View>
                <View
                  style={[
                    styles.metricCard,
                    { backgroundColor: withAlpha(colors.outline, 0.08) },
                  ]}
                >
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {formatSignalPercent(selectedRegion.confidence)}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>
                    confidence
                  </Text>
                </View>
              </View>
              <Text style={[styles.disclaimerTitle, { color: colors.text }]}>
                Evidence
              </Text>
              {maskEvidence(
                selectedRegion.evidenceSnippets,
                hideJournalPreviews,
              ).map(snippet => (
                <View
                  key={`${selectedRegion.id}-${snippet}`}
                  style={[
                    styles.evidenceChip,
                    { backgroundColor: withAlpha(colors.outline, 0.08) },
                  ]}
                >
                  <Text style={[styles.evidenceText, { color: colors.text }]}>
                    {snippet}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.disclaimerTitle, { color: colors.text }]}>
              All regions
            </Text>
            {readyMap?.regions.map(region => {
              const selected = region.id === selectedRegion.id;

              return (
                <Pressable
                  key={region.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${
                    region.productLabel
                  }, ${formatSignalPercent(region.signalScore)} signal`}
                  onPress={() => setSelectedRegionId(region.id)}
                  style={({ pressed }) => [
                    styles.regionButton,
                    {
                      backgroundColor: selected
                        ? withAlpha(colors.nodeHot, 0.12)
                        : withAlpha(colors.outline, 0.05),
                      borderColor: selected
                        ? withAlpha(colors.nodeHot, 0.22)
                        : withAlpha(colors.outline, 0.14),
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.regionButtonCopy}>
                    <Text
                      style={[styles.regionButtonTitle, { color: colors.text }]}
                    >
                      {region.rank}. {region.productLabel}
                    </Text>
                    <Text
                      style={[
                        styles.regionButtonSubtitle,
                        { color: colors.muted },
                      ]}
                    >
                      {region.brainRegionSubtitle}
                    </Text>
                  </View>
                  <Text
                    style={[styles.regionButtonValue, { color: colors.text }]}
                  >
                    {formatSignalPercent(region.signalScore)}
                  </Text>
                </Pressable>
              );
            })}

            <Text style={[styles.disclaimerTitle, { color: colors.text }]}>
              {mindMap.disclaimer.title}
            </Text>
            <Text style={[styles.disclaimerBody, { color: colors.muted }]}>
              {mindMap.disclaimer.body}
            </Text>
          </ScrollView>
        ) : null}
      </>
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <Animated.View
        style={[
          styles.screen,
          {
            opacity: reveal,
            transform: [
              {
                translateY: reveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.headerRow}>
          {showBackButton ? (
            <Pressable
              accessibilityLabel="Back to Insights"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: withAlpha(colors.nodeHot, 0.1),
                  borderColor: withAlpha(colors.nodeHot, 0.18),
                },
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft color={colors.text} size={18} />
            </Pressable>
          ) : (
            <View style={styles.iconButtonSpacer} />
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Mind Map
          </Text>
          <Pressable
            accessibilityLabel="Recenter Mind Map"
            onPress={() => setCameraResetToken(token => token + 1)}
            style={({ pressed }) => [
              styles.recenterPill,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.1),
                borderColor: withAlpha(colors.nodeHot, 0.18),
              },
              pressed && styles.pressed,
            ]}
          >
            <RotateCcw color={colors.nodeHot} size={14} />
            <Text style={[styles.recenterPillText, { color: colors.text }]}>
              Recenter
            </Text>
          </Pressable>
        </View>

        {!isEducationalMode ? (
          <View
            style={[
              styles.rangeControl,
              {
                backgroundColor: withAlpha(colors.outline, 0.08),
                borderColor: withAlpha(colors.outline, 0.14),
              },
            ]}
          >
            {(['latest_week', 'all_time'] as const).map(option => {
              const selected = range === option;

              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={
                    option === 'latest_week' ? 'Latest week' : 'All reflections'
                  }
                  onPress={() => {
                    setRange(option);
                    setIsExpanded(false);
                  }}
                  style={({ pressed }) => [
                    styles.rangePill,
                    {
                      backgroundColor: selected ? colors.card : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.rangePillText,
                      { color: selected ? colors.text : colors.muted },
                    ]}
                  >
                    {option === 'latest_week'
                      ? 'Latest week'
                      : 'All reflections'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.sceneShell}>
          <View
            style={[
              styles.sceneFrame,
              {
                backgroundColor: colors.background,
                borderColor: withAlpha(colors.outline, 0.18),
              },
            ]}
          >
            <NativeMindMapView
              cameraResetToken={cameraResetToken}
              graphPalette={colors}
              onRegionPress={(event: NativeMindMapRegionPressEvent) =>
                setSelectedRegionId(event.nativeEvent.regionId)
              }
              reduceMotionEnabled={reduceMotionEnabled}
              regions={
                isEducationalMode ? educationalNativeRegions : nativeRegions
              }
              selectedRegionId={selectedRegionId}
              style={styles.nativeScene}
              themeMode={theme.mode}
            />
            <View pointerEvents="none" style={styles.sceneHintWrap}>
              <Text style={[styles.sceneHint, { color: colors.muted }]}>
                {isEducationalMode
                  ? 'Drag to rotate · pinch to zoom · tap a region to learn'
                  : 'Drag to rotate · pinch to zoom · tap a region'}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: colors.card,
              borderColor: withAlpha(colors.outline, 0.18),
              paddingBottom: insets.bottom + 14,
              height: `${sheetHeight * 100}%`,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded
                ? 'Collapse Mind Map details'
                : 'Expand Mind Map details'
            }
            onPress={() => setIsExpanded(value => !value)}
            style={({ pressed }) => [
              styles.sheetHandleRow,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: withAlpha(colors.outline, 0.22) },
              ]}
            />
            <ChevronUp
              color={colors.muted}
              size={18}
              style={{
                transform: [{ rotate: isExpanded ? '0deg' : '180deg' }],
              }}
            />
          </Pressable>
          {renderStatusSheet()}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSpacer: {
    height: 42,
    width: 42,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  recenterPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recenterPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rangeControl: {
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  rangePill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sceneShell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 220,
  },
  sceneFrame: {
    flex: 1,
    minHeight: 360,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 1,
  },
  nativeScene: {
    flex: 1,
  },
  sceneHintWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
    alignItems: 'center',
  },
  sceneHint: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomSheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandleRow: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
  },
  sheetContent: {
    gap: 12,
  },
  sheetPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  sheetPreviewCopy: {
    flex: 1,
    gap: 4,
  },
  sheetEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sheetHeadline: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  sheetBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  signalBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  educationalBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  signalBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  sheetScrollContent: {
    gap: 12,
    paddingTop: 12,
  },
  regionDetailCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  regionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  regionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  regionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  disclaimerBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  evidenceChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  evidenceText: {
    fontSize: 13,
    lineHeight: 18,
  },
  regionButton: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  regionButtonCopy: {
    flex: 1,
    gap: 2,
  },
  regionButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  regionButtonSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  regionButtonValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  supportText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
  },
});
