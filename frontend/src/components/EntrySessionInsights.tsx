import HapticPressable from './HapticPressable';
import {
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { Brain, RotateCcw, Sparkles } from 'lucide-react-native';
import MindMapRegionDetailSheet from './MindMapRegionDetailSheet';
import { getMindMapRegionEducation } from '../features/brainMap3D/mindMapEducation';
import { getScoreTier } from '../features/brainMap3D/regionTier';
import {
  getBrainMapColors,
  withAlpha,
} from '../features/brainMap3D/brainMapTheme';
import type { MindMapNativeRegion } from '../features/brainMap3D/mindMapRegionTypes';
import WebMindMapView, {
  type NativeMindMapRegionPressEvent,
} from '../features/brainMap3D/webRenderer/WebMindMapView';
import type { GuidedReflectionSessionAnalysisResponse } from '../services/guidedReflectionService';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';

type InsightsTab = 'analysis' | 'mind_map';

type Props = {
  analysis: GuidedReflectionSessionAnalysisResponse;
};

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

export default function EntrySessionInsights({ analysis }: Props) {
  const theme = useTheme();
  const mapColors = getBrainMapColors(theme);
  const [activeTab, setActiveTab] = useState<InsightsTab>('analysis');
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const [showAllCenters, setShowAllCenters] = useState(false);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [selectedRegionId, setSelectedRegionId] = useState(
    analysis.brainSessionMap.dominantCenterId,
  );
  const [displayedRegionId, setDisplayedRegionId] = useState(
    analysis.brainSessionMap.dominantCenterId,
  );
  const [isDetailSheetVisible, setIsDetailSheetVisible] = useState(false);
  const tabProgress = useRef(new Animated.Value(0)).current;
  const contentReveal = useRef(new Animated.Value(1)).current;
  const signalReveal = useRef(new Animated.Value(1)).current;
  const thumbWidth = Math.max(0, (segmentedWidth - 6) / 2);
  const topics = (
    analysis.detectedTopics ||
    analysis.topicsObserved ||
    []
  ).slice(0, 5);
  const centers = analysis.brainSessionMap.centers;
  const visibleCenters = showAllCenters ? centers : centers.slice(0, 3);
  const selectedRegion =
    centers.find(center => center.id === displayedRegionId) ||
    analysis.brainSessionMap.dominantCenter;
  const selectedScore = Math.round(selectedRegion.score * 100);
  const selectedTier = getScoreTier(selectedScore, theme.colors);
  const regions = useMemo<MindMapNativeRegion[]>(
    () =>
      centers.map(center => ({
        id: center.id,
        label: center.productName,
        subtitle: center.brainRegion,
        signalScore: center.score,
        confidence: center.confidence,
        intensity: center.intensity,
        isStrongest: center.id === analysis.brainSessionMap.dominantCenterId,
        rank: center.rank,
      })),
    [analysis.brainSessionMap.dominantCenterId, centers],
  );

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (active) {
          setReduceMotionEnabled(value);
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const nextValue = activeTab === 'analysis' ? 0 : 1;

    if (reduceMotionEnabled) {
      tabProgress.setValue(nextValue);
      contentReveal.setValue(1);
      return;
    }

    tabProgress.stopAnimation();
    contentReveal.stopAnimation();
    contentReveal.setValue(0);
    Animated.parallel([
      Animated.timing(tabProgress, {
        toValue: nextValue,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentReveal, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab, contentReveal, reduceMotionEnabled, tabProgress]);

  useEffect(() => {
    if (!reduceMotionEnabled) {
      return;
    }

    signalReveal.stopAnimation();
    signalReveal.setValue(1);
    setDisplayedRegionId(selectedRegionId);
  }, [reduceMotionEnabled, selectedRegionId, signalReveal]);

  const selectTab = (nextTab: InsightsTab) => {
    if (nextTab === activeTab) {
      return;
    }

    if (!reduceMotionEnabled) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    triggerHaptic('optionSelected').catch(() => undefined);
    setActiveTab(nextTab);
  };

  const toggleCenters = () => {
    if (!reduceMotionEnabled) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    triggerHaptic('secondaryAction').catch(() => undefined);
    setShowAllCenters(current => !current);
  };

  const handleRegionPress = (event: NativeMindMapRegionPressEvent) => {
    const nextRegion = centers.find(
      center => center.id === event.nativeEvent.regionId,
    );
    if (!nextRegion || nextRegion.id === selectedRegionId) {
      return;
    }

    setSelectedRegionId(nextRegion.id);
    triggerHaptic('optionSelected').catch(() => undefined);

    if (reduceMotionEnabled) {
      setDisplayedRegionId(nextRegion.id);
      return;
    }

    signalReveal.stopAnimation();
    Animated.timing(signalReveal, {
      toValue: 0,
      duration: 90,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setDisplayedRegionId(nextRegion.id);
      signalReveal.setValue(0);
      Animated.timing(signalReveal, {
        toValue: 1,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const openRegionDetails = () => {
    triggerHaptic('secondaryAction').catch(() => undefined);
    setIsDetailSheetVisible(true);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Brain color={theme.colors.primary} size={17} />
        <Text style={[styles.title, { color: theme.colors.foreground }]}>
          Session insights
        </Text>
      </View>

      <View
        accessibilityRole="tablist"
        onLayout={event => setSegmentedWidth(event.nativeEvent.layout.width)}
        style={[
          styles.segmented,
          {
            backgroundColor: theme.colors.secondary,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentThumb,
            {
              backgroundColor: theme.colors.card,
              width: thumbWidth,
              transform: [
                {
                  translateX: tabProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, thumbWidth],
                  }),
                },
              ],
            },
          ]}
        />
        {[
          { key: 'analysis' as const, label: 'Analysis' },
          { key: 'mind_map' as const, label: 'Mind Map' },
        ].map(tab => (
          <HapticPressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
            onPress={() => selectTab(tab.key)}
            style={styles.segmentButton}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeTab === tab.key
                      ? theme.colors.foreground
                      : theme.colors.mutedForeground,
                },
              ]}
            >
              {tab.label}
            </Text>
          </HapticPressable>
        ))}
      </View>

      <Animated.View
        style={{
          opacity: contentReveal,
          transform: [
            {
              translateY: contentReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        }}
      >
        {activeTab === 'analysis' ? (
          <View style={styles.contentStack}>
            <View
              style={[
                styles.insightBlock,
                { backgroundColor: withAlpha(theme.colors.primary, 0.07) },
              ]}
            >
              <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
                SAVED SESSION ANALYSIS
              </Text>
              <Text
                style={[styles.blockTitle, { color: theme.colors.foreground }]}
              >
                A quick read on this session
              </Text>
              <Text
                style={[styles.body, { color: theme.colors.mutedForeground }]}
              >
                {analysis.analysis}
              </Text>
              <Text
                style={[
                  styles.majorInsight,
                  { color: theme.colors.foreground },
                ]}
              >
                {analysis.majorInsight}
              </Text>
            </View>

            <View
              style={[
                styles.insightBlock,
                { borderColor: withAlpha(theme.colors.primary, 0.2) },
              ]}
            >
              <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
                MOST NOTICED CENTER
              </Text>
              <View style={styles.centerHeading}>
                <View style={styles.centerCopy}>
                  <Text
                    style={[
                      styles.blockTitle,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {analysis.brainSessionMap.dominantCenter.productName}
                  </Text>
                  <Text
                    style={[
                      styles.region,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {analysis.brainSessionMap.dominantCenter.brainRegion}
                  </Text>
                </View>
                <Text style={[styles.signal, { color: theme.colors.primary }]}>
                  {formatPercent(analysis.brainSessionMap.dominantCenter.score)}
                </Text>
              </View>
              <Text
                style={[styles.body, { color: theme.colors.mutedForeground }]}
              >
                {analysis.brainSessionMap.dominantCenter.shortInsight}
              </Text>
            </View>

            <View
              style={[
                styles.insightBlock,
                { borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
                CENTER BREAKDOWN
              </Text>
              <View style={styles.centerList}>
                {visibleCenters.map(center => (
                  <View key={center.id} style={styles.centerRow}>
                    <View style={styles.centerCopy}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.centerName,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        {center.productName}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.region,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        {center.brainRegion}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.centerScore,
                        {
                          color:
                            center.id ===
                            analysis.brainSessionMap.dominantCenterId
                              ? theme.colors.primary
                              : theme.colors.mutedForeground,
                        },
                      ]}
                    >
                      {formatPercent(center.score)}
                    </Text>
                  </View>
                ))}
              </View>
              {centers.length > 3 ? (
                <HapticPressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showAllCenters ? 'Show fewer centers' : 'Show all centers'
                  }
                  onPress={toggleCenters}
                  style={styles.textAction}
                >
                  <Text
                    style={[
                      styles.textActionLabel,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {showAllCenters ? 'Show less' : 'Show all centers'}
                  </Text>
                </HapticPressable>
              ) : null}
            </View>

            {topics.length ? (
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
                        styles.topicText,
                        { color: theme.colors.foreground },
                      ]}
                    >
                      {formatLabel(topic)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.mapStack}>
            <View style={styles.mapHeading}>
              <View>
                <Text style={[styles.eyebrow, { color: mapColors.nodeHot }]}>
                  YOUR SESSION MIND MAP
                </Text>
                <Text style={[styles.mapTitle, { color: mapColors.text }]}>
                  Explore what stood out
                </Text>
              </View>
              <HapticPressable
                accessibilityLabel="Recenter Session Mind Map"
                accessibilityRole="button"
                onPress={() => {
                  setCameraResetToken(token => token + 1);
                  triggerHaptic('secondaryAction').catch(() => undefined);
                }}
                style={[
                  styles.recenter,
                  {
                    backgroundColor: withAlpha(mapColors.nodeHot, 0.1),
                    borderColor: withAlpha(mapColors.outline, 0.2),
                  },
                ]}
              >
                <RotateCcw color={mapColors.nodeHot} size={16} />
              </HapticPressable>
            </View>
            <View
              style={[
                styles.sceneFrame,
                { borderColor: withAlpha(mapColors.outline, 0.15) },
              ]}
            >
              <WebMindMapView
                cameraResetToken={cameraResetToken}
                graphPalette={mapColors}
                onRegionPress={handleRegionPress}
                reduceMotionEnabled={reduceMotionEnabled}
                regions={regions}
                selectedRegionId={selectedRegionId}
                style={styles.scene}
                themeMode={theme.mode}
              />
              <View pointerEvents="none" style={styles.sceneHintWrap}>
                <Text style={[styles.sceneHint, { color: mapColors.muted }]}>
                  Drag to rotate · pinch to zoom · tap a region
                </Text>
              </View>
            </View>
            <Animated.View
              style={{
                opacity: signalReveal,
                transform: [
                  {
                    translateY: signalReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [6, 0],
                    }),
                  },
                ],
              }}
            >
              <HapticPressable
                accessibilityHint="Opens AI signal and area details"
                accessibilityLabel={`View details for ${selectedRegion.productName}, score ${selectedScore} out of 100, ${selectedTier.label}`}
                accessibilityRole="button"
                onPress={openRegionDetails}
                style={[
                  styles.selectedCard,
                  {
                    backgroundColor: withAlpha(mapColors.nodeHot, 0.09),
                    borderColor: withAlpha(mapColors.nodeHot, 0.2),
                  },
                ]}
              >
                <View style={styles.selectedHeading}>
                  <Sparkles color={mapColors.nodeHot} size={15} />
                  <Text
                    style={[styles.selectedLabel, { color: mapColors.muted }]}
                  >
                    SESSION SIGNAL
                  </Text>
                  <Text
                    style={[styles.selectedScore, { color: mapColors.nodeHot }]}
                  >
                    {selectedScore} / 100
                  </Text>
                </View>
                <Text style={[styles.selectedTitle, { color: mapColors.text }]}>
                  {selectedRegion.productName}
                </Text>
                <Text style={[styles.region, { color: mapColors.muted }]}>
                  {selectedRegion.brainRegion}
                </Text>
                <Text
                  numberOfLines={3}
                  style={[styles.body, { color: mapColors.muted }]}
                >
                  {selectedRegion.shortInsight}
                </Text>
              </HapticPressable>
            </Animated.View>
          </View>
        )}
      </Animated.View>

      <MindMapRegionDetailSheet
        education={getMindMapRegionEducation(selectedRegion.id)}
        onDismiss={() => setIsDetailSheetVisible(false)}
        region={selectedRegion}
        visible={isDetailSheetVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 16 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  segmented: {
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 16,
    padding: 3,
  },
  segmentThumb: {
    position: 'absolute',
    borderRadius: 12,
    bottom: 3,
    left: 3,
    top: 3,
  },
  segmentButton: {
    alignItems: 'center',
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '700' },
  contentStack: { gap: 12, paddingTop: 16 },
  insightBlock: { borderRadius: 18, borderWidth: 1, padding: 15 },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.05 },
  blockTitle: { fontSize: 17, fontWeight: '700', lineHeight: 23, marginTop: 8 },
  body: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  majorInsight: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 12,
  },
  centerHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  centerCopy: { flex: 1 },
  region: { fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 2 },
  signal: { fontSize: 13, fontWeight: '600', marginTop: 9 },
  centerList: { gap: 13, marginTop: 14 },
  centerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  centerName: { fontSize: 13, fontWeight: '700' },
  centerScore: { fontSize: 12, fontWeight: '600' },
  textAction: {
    alignSelf: 'flex-start',
    marginTop: 14,
    minHeight: 32,
    justifyContent: 'center',
  },
  textActionLabel: { fontSize: 12, fontWeight: '600' },
  topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  topicChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  topicText: { fontSize: 11, fontWeight: '700' },
  mapStack: { paddingTop: 16 },
  mapHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mapTitle: { fontSize: 18, fontWeight: '700', marginTop: 3 },
  recenter: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sceneFrame: {
    borderRadius: 22,
    borderWidth: 1,
    height: 360,
    marginTop: 14,
    overflow: 'hidden',
  },
  scene: { flex: 1 },
  sceneHintWrap: {
    alignItems: 'center',
    bottom: 10,
    left: 10,
    position: 'absolute',
    right: 10,
  },
  sceneHint: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  selectedCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    padding: 15,
  },
  selectedHeading: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  selectedLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.9 },
  selectedScore: { fontSize: 11, fontWeight: '600', marginLeft: 'auto' },
  selectedTitle: { fontSize: 16, fontWeight: '700', marginTop: 9 },
});
