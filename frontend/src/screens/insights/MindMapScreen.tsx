import HapticPressable from '../../components/HapticPressable';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  RotateCcw,
} from 'lucide-react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import WebMindMapView, {
  type NativeMindMapRegionPressEvent,
} from '../../features/brainMap3D/webRenderer/WebMindMapView';
import {
  getBrainMapColors,
  withAlpha,
} from '../../features/brainMap3D/brainMapTheme';
import type { MindMapNativeRegion } from '../../features/brainMap3D/mindMapRegionTypes';
import type { BrainReflectionCenterId } from '../../services/guidedReflectionService';
import { env } from '../../config/env';
import { MainAppStackParamList } from '../../navigation/navigation';
import {
  getInsightsMindMap,
  getInsightsMindMapRegionSeries,
  type InsightsMindMap,
  type InsightsMindMapRange,
  type InsightsMindMapReady,
} from '../../services/insightsService';
import { trackPaywallEvent } from '../../services/paywallService';
import MindMapRegionDetailModal, {
  type MindMapRegionModalData,
} from '../../components/MindMapRegionDetailModal';
import type { RegionTrendPoint } from '../../components/RegionTrendChart';
import { getScoreTier } from '../../features/brainMap3D/regionTier';
import { triggerHaptic } from '../../services/hapticsService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';

type MindMapNavigation = NativeStackNavigationProp<MainAppStackParamList>;

const LOCK_ICON = require('../../assets/png/entry/lock.png');

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

// Fixed height per region row, so the sliding selection highlight can align to
// `selectedIndex * ROW_HEIGHT`.
const ROW_HEIGHT = 58;

// One card in the bottom region list. Shared between the free/educational
// view (info only) and the premium view (adds signal % + tier), differing only
// in what opens on tap.
type CarouselRegion = {
  id: BrainReflectionCenterId;
  label: string;
  subtitle: string;
  body: string;
  ready: boolean;
  signalPercent: number | null;
  tierLabel: string | null;
};

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
    rank: region.rank,
  }));
}

function buildEducationalNativeRegions(): MindMapNativeRegion[] {
  return EDUCATIONAL_REGIONS.map((region, index) => ({
    id: region.id,
    label: region.label,
    subtitle: region.subtitle,
    // These fixed values only render a neutral learning model. They are not user signals.
    signalScore: 0.5,
    confidence: 0,
    intensity: 'moderate',
    isStrongest: false,
    rank: index + 1,
  }));
}

function maskEvidence(snippets: string[], hidePreviews: boolean) {
  if (!hidePreviews) {
    return snippets;
  }

  return snippets.map(() => 'Preview hidden by your entry privacy setting.');
}

function MindMapShimmerBlock({
  shimmerProgress,
  baseColor,
  highlightColor,
  style,
}: {
  shimmerProgress: Animated.Value;
  baseColor: string;
  highlightColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.shimmerBlock, { backgroundColor: baseColor }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmerSheen,
          {
            backgroundColor: highlightColor,
            transform: [
              {
                translateX: shimmerProgress.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-168, 264],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

export default function MindMapScreen({
  showBackButton = true,
}: {
  showBackButton?: boolean;
}) {
  const navigation = useNavigation<MindMapNavigation>();
  const theme = useTheme();
  const colors = getBrainMapColors(theme);
  // Strictly use the app's brand accent (orange) rather than the brain-map
  // palette's cream/gold, so this screen matches the rest of the app.
  const accent = theme.colors.primary;
  const onAccent = theme.colors.primaryForeground;
  const insets = useSafeAreaInsets();
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );
  const hideJournalPreviews = useAppStore(state => state.hideJournalPreviews);
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );
  const { width: windowWidth } = useWindowDimensions();
  // The Mind Map shows all-time reflection analytics.
  const range: InsightsMindMapRange = 'all_time';
  const [mindMap, setMindMap] = useState<InsightsMindMap | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [modalRegionId, setModalRegionId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [series, setSeries] = useState<RegionTrendPoint[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  // Which horizontal page (0 = building, 1 = region list) is in view.
  const [pageIndex, setPageIndex] = useState(0);
  // Gate: only load region data once the 3D model has rendered (or the safety
  // fallback fires), so the scene always appears first.
  const [modelReady, setModelReady] = useState(false);

  const reveal = useRef(new Animated.Value(0)).current;
  const panelReveal = useRef(new Animated.Value(1)).current;
  const shimmerProgress = useRef(new Animated.Value(-1)).current;
  // Selected-region card content crossfade + sliding list highlight offset.
  const cardFade = useRef(new Animated.Value(1)).current;
  const selectorY = useRef(new Animated.Value(0)).current;
  const pagerRef = useRef<ScrollView>(null);
  // Dev bypass (env.allowNonPremiumAi) lets the premium Mind Map be tested
  // without a real subscription; pair with backend AI_ALLOW_NON_PREMIUM.
  const isEducationalMode = !env.allowNonPremiumAi && !isPremiumUser;

  const handleBack = useCallback(() => {
    // Mind Map can be reached as a bottom-tab (no back stack) or pushed from
    // Insights/Home. Fall back to Home so back never errors with GO_BACK.
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('Home');
  }, [navigation]);

  const openRegionModal = useCallback(
    (regionId: BrainReflectionCenterId) => {
      setSelectedRegionId(regionId);
      setModalRegionId(regionId);
      setModalVisible(true);
      triggerHaptic('optionSelected').catch(() => undefined);

      // Only premium ready-state regions have a personal series to fetch;
      // free / building regions show the educational primer only.
      const readyRegion =
        mindMap?.status === 'ready'
          ? mindMap.regions.find(item => item.id === regionId)
          : null;
      if (!readyRegion) {
        setSeries([]);
        setSeriesLoading(false);
        return;
      }

      setSeries([]);
      setSeriesLoading(true);
      getInsightsMindMapRegionSeries(regionId, range)
        .then(result =>
          setSeries(
            result.points.map(point => ({
              label: point.label,
              value: point.value,
            })),
          ),
        )
        .catch(() => setSeries([]))
        .finally(() => setSeriesLoading(false));
    },
    [mindMap, range],
  );

  const handleUpgrade = useCallback(() => {
    triggerHaptic('optionSelected').catch(() => undefined);
    trackPaywallEvent({
      placementKey: 'insights_ai_tab_locked',
      screenKey: 'insights',
      eventType: 'locked_feature_tap',
      wasInterruptive: false,
    }).catch(() => undefined);
    // The region detail sheet is a native Modal — the paywall is a pushed route,
    // so it would otherwise render behind a sheet that never closed.
    setModalVisible(false);
    setTimeout(() => {
      openPaywallForPlacement({
        placementKey: 'insights_ai_tab_locked',
        returnStage: 'main-app',
        screenKey: 'insights',
      });
    }, 0);
  }, [openPaywallForPlacement]);

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

  const handleRetry = useCallback(() => {
    if (isLoading) {
      return;
    }

    loadMindMap().catch(() => undefined);
  }, [isLoading, loadMindMap]);

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

  // Safety fallback: if the WebView never posts "ready" (load error, etc.),
  // release the data-load gate anyway so the panel isn't stuck loading forever.
  useEffect(() => {
    if (modelReady) {
      return;
    }
    const timer = setTimeout(() => setModelReady(true), 1500);
    return () => clearTimeout(timer);
  }, [modelReady]);

  useEffect(() => {
    // Wait for the model to render before pulling region data (model first).
    if (!modelReady) {
      return;
    }

    // Free users never call the premium mind-map endpoint, and their screen is
    // entirely static: the educational regions plus the gated signal card.
    if (isEducationalMode) {
      setIsLoading(false);
      setMindMap(null);
      setSelectedRegionId(EDUCATIONAL_REGIONS[0].id);
      return;
    }

    loadMindMap().catch(() => undefined);
  }, [modelReady, isEducationalMode, loadMindMap]);

  const readyMap = mindMap?.status === 'ready' ? mindMap : null;
  const modalRegion = useMemo<MindMapRegionModalData | null>(() => {
    if (!modalRegionId) {
      return null;
    }

    const region = readyMap?.regions.find(item => item.id === modalRegionId);
    if (region) {
      return {
        id: region.id,
        productLabel: region.productLabel,
        brainRegionSubtitle: region.brainRegionSubtitle,
        signalScore: region.signalScore,
        tierLabel: region.tierLabel,
        shortInsight: region.shortInsight,
        actionStep: region.actionStep,
        evidence: maskEvidence(region.evidenceSnippets, hideJournalPreviews),
        trendLabel: region.trendLabel,
      };
    }

    // Educational fallback for free users: region primer only, no personal data.
    const educational = EDUCATIONAL_REGIONS.find(item => item.id === modalRegionId);
    if (educational) {
      return {
        id: educational.id,
        productLabel: educational.label,
        brainRegionSubtitle: educational.subtitle,
        description: educational.description,
      };
    }

    return null;
  }, [readyMap, modalRegionId, hideJournalPreviews]);
  const modalSignalAvailable = Boolean(
    readyMap?.regions.some(item => item.id === modalRegionId),
  );
  // A premium user with no signal for this region (map still building,
  // support-first, or mid-fetch) has nothing to unlock — they already pay. The
  // sheet says the signals aren't generated yet; the upgrade prompt is strictly
  // a free-tier state.
  const signalPending = !isEducationalMode && !modalSignalAvailable;
  const nativeRegions = useMemo(() => buildNativeRegions(readyMap), [readyMap]);
  const educationalNativeRegions = useMemo(
    () => buildEducationalNativeRegions(),
    [],
  );
  const carouselRegions: CarouselRegion[] = readyMap
    ? readyMap.regions.map(region => ({
        id: region.id,
        label: region.productLabel,
        subtitle: region.brainRegionSubtitle,
        body: region.shortInsight,
        ready: true,
        signalPercent: Math.round(region.signalScore * 100),
        tierLabel: region.tierLabel,
      }))
    : EDUCATIONAL_REGIONS.map(region => ({
        id: region.id,
        label: region.label,
        subtitle: region.subtitle,
        body: region.description,
        ready: false,
        signalPercent: null,
        tierLabel: null,
      }));

  const buildingMap = mindMap?.status === 'building' ? mindMap : null;

  // The Mind Map is "ready" (full vertical list, no build slide) when the
  // premium payload is ready. Free users are always "ready": their screen is
  // the static educational list with the signal card gated behind the paywall —
  // entry progress toward the unlock threshold is a premium-only concern.
  const isReady = readyMap != null || isEducationalMode;
  // Show the leading "still building" slide only before the threshold is met.
  const showBuildingSlide =
    !isEducationalMode && !isReady && mindMap?.status !== 'support_first';
  // Brief loading gap while the premium fetch is in flight. The free screen has
  // nothing to wait on, so it never shows the skeleton.
  const isPanelLoading = isEducationalMode
    ? false
    : isLoading && !readyMap && !buildingMap;
  const panelState = error
    ? 'error'
    : isPanelLoading
    ? 'loading'
    : mindMap?.status === 'support_first'
    ? 'support-first'
    : showBuildingSlide
    ? 'building'
    : 'regions';
  const shouldAnimateShimmer = typeof jest === 'undefined';

  useLayoutEffect(() => {
    panelReveal.stopAnimation();

    if (reduceMotionEnabled) {
      panelReveal.setValue(1);
      return undefined;
    }

    panelReveal.setValue(0);
    const animation = Animated.timing(panelReveal, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [panelReveal, panelState, reduceMotionEnabled]);

  useEffect(() => {
    if (
      !isPanelLoading ||
      reduceMotionEnabled ||
      !shouldAnimateShimmer
    ) {
      shimmerProgress.stopAnimation();
      shimmerProgress.setValue(-1);
      return undefined;
    }

    shimmerProgress.setValue(-1);
    const animation = Animated.loop(
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: 1120,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    animation.start();
    return () => {
      animation.stop();
      shimmerProgress.stopAnimation();
    };
  }, [
    isPanelLoading,
    reduceMotionEnabled,
    shouldAnimateShimmer,
    shimmerProgress,
  ]);

  const selectedIndex = Math.max(
    0,
    carouselRegions.findIndex(item => item.id === selectedRegionId),
  );

  // Softly crossfade the selected-region card when the selection changes.
  useEffect(() => {
    if (reduceMotionEnabled) {
      cardFade.setValue(1);
      return;
    }

    cardFade.setValue(0);
    Animated.timing(cardFade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedRegionId, reduceMotionEnabled, cardFade]);

  // Slide the list highlight to the selected row.
  useEffect(() => {
    const target = selectedIndex * ROW_HEIGHT;
    if (reduceMotionEnabled) {
      selectorY.setValue(target);
      return;
    }

    Animated.timing(selectorY, {
      toValue: target,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, reduceMotionEnabled, selectorY]);

  const handlePagerScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / windowWidth,
    );
    if (nextIndex !== pageIndex) {
      setPageIndex(nextIndex);
    }
  };

  // Selecting a region (from a brain pin or a list row) fills the selected
  // card and — while the building pager is showing — swipes to the list slide.
  const selectRegion = (regionId: string) => {
    setSelectedRegionId(regionId);
    triggerHaptic('optionSelected').catch(() => undefined);
    if (showBuildingSlide) {
      pagerRef.current?.scrollTo({ x: windowWidth, animated: true });
      setPageIndex(1);
    }
  };

  // Slide 1: "still building" progress, driven by the premium payload's entry
  // progress. Premium-only — free users never see an unlock meter.
  const renderBuildingCard = () => {
    if (!buildingMap) {
      return null;
    }

    const periodLabel = buildingMap.period.label;
    const active = buildingMap.progress.clearEntryCount;
    const needed = Math.max(
      1,
      buildingMap.progress.clearEntryCount + buildingMap.progress.entriesNeeded,
    );
    const pct = Math.max(6, Math.min(100, Math.round((active / needed) * 100)));

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(accent, 0.24),
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: accent }]}>{periodLabel}</Text>
        <Text style={[styles.statusTitle, { color: colors.text }]}>
          Your Mind Map is still building
        </Text>
        <View style={styles.progressBlock}>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: withAlpha(colors.outline, 0.16) },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                { backgroundColor: accent, width: `${pct}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressCount, { color: colors.text }]}>
            {active}/{needed}
          </Text>
          <Text
            style={[styles.progressCaption, { color: colors.muted }]}
            numberOfLines={2}
          >
            entries so far — a few more unlock your full Mind Map.
          </Text>
        </View>
      </View>
    );
  };

  // Mirrors the selected-region and region-list groups so content does not
  // jump when the map payload or free entry count arrives.
  const renderLoadingCards = () => {
    const baseColor = withAlpha(
      colors.outline,
      theme.mode === 'dark' ? 0.24 : 0.12,
    );
    const highlightColor = withAlpha(
      accent,
      theme.mode === 'dark' ? 0.26 : 0.16,
    );

    return (
      <View
        accessible
        accessibilityLabel="Loading Mind Map details"
        testID="mind-map-loading-skeleton"
        style={styles.skeletonStack}
      >
        <View
          testID="mind-map-loading-primary-card"
          style={[
            styles.card,
            styles.skeletonCard,
            {
              backgroundColor: colors.card,
              borderColor: withAlpha(colors.outline, 0.14),
            },
          ]}
        >
          <MindMapShimmerBlock
            baseColor={baseColor}
            highlightColor={highlightColor}
            shimmerProgress={shimmerProgress}
            style={styles.skeletonEyebrow}
          />
          <MindMapShimmerBlock
            baseColor={baseColor}
            highlightColor={highlightColor}
            shimmerProgress={shimmerProgress}
            style={styles.skeletonTitle}
          />
          <MindMapShimmerBlock
            baseColor={baseColor}
            highlightColor={highlightColor}
            shimmerProgress={shimmerProgress}
            style={styles.skeletonSubtitle}
          />
          <MindMapShimmerBlock
            baseColor={baseColor}
            highlightColor={highlightColor}
            shimmerProgress={shimmerProgress}
            style={styles.skeletonBodyLine}
          />
          <MindMapShimmerBlock
            baseColor={baseColor}
            highlightColor={highlightColor}
            shimmerProgress={shimmerProgress}
            style={styles.skeletonBodyLineShort}
          />
          <View style={styles.skeletonScoreRow}>
            <MindMapShimmerBlock
              baseColor={baseColor}
              highlightColor={highlightColor}
              shimmerProgress={shimmerProgress}
              style={styles.skeletonScore}
            />
            <MindMapShimmerBlock
              baseColor={baseColor}
              highlightColor={highlightColor}
              shimmerProgress={shimmerProgress}
              style={styles.skeletonPill}
            />
          </View>
        </View>

        <View
          testID="mind-map-loading-region-card"
          style={[
            styles.card,
            styles.skeletonRegionCard,
            {
              backgroundColor: colors.card,
              borderColor: withAlpha(colors.outline, 0.14),
            },
          ]}
        >
          <MindMapShimmerBlock
            baseColor={baseColor}
            highlightColor={highlightColor}
            shimmerProgress={shimmerProgress}
            style={styles.skeletonSectionLabel}
          />
          {[0, 1, 2, 3].map(index => (
            <View key={index} style={styles.skeletonRegionRow}>
              <MindMapShimmerBlock
                baseColor={baseColor}
                highlightColor={highlightColor}
                shimmerProgress={shimmerProgress}
                style={styles.skeletonRank}
              />
              <View style={styles.skeletonRegionCopy}>
                <MindMapShimmerBlock
                  baseColor={baseColor}
                  highlightColor={highlightColor}
                  shimmerProgress={shimmerProgress}
                  style={styles.skeletonRegionTitle}
                />
                <MindMapShimmerBlock
                  baseColor={baseColor}
                  highlightColor={highlightColor}
                  shimmerProgress={shimmerProgress}
                  style={styles.skeletonRegionSubtitle}
                />
              </View>
              <MindMapShimmerBlock
                baseColor={baseColor}
                highlightColor={highlightColor}
                shimmerProgress={shimmerProgress}
                style={styles.skeletonValue}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Top of slide 2: the region currently selected on the brain model. Tapping
  // opens the detail modal (premium graph / educational primer). For free
  // ready users the scoring row becomes a skeleton behind an upgrade prompt.
  const renderSelectedCard = () => {
    const region =
      carouselRegions.find(item => item.id === selectedRegionId) ??
      carouselRegions[0];
    if (!region) {
      return null;
    }

    const freeLocked = isEducationalMode && isReady;
    const lockedSkeletonColor = withAlpha(
      colors.outline,
      theme.mode === 'dark' ? 0.24 : 0.12,
    );

    return (
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel={`${region.label}. ${
          region.ready ? 'View analytics.' : 'Learn more.'
        }`}
        onPress={() => openRegionModal(region.id)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(accent, 0.24),
          },
          pressed && styles.pressed,
        ]}
      >
        <Animated.View style={{ opacity: cardFade }}>
        <Text style={[styles.eyebrow, { color: accent }]}>Selected region</Text>
        <Text style={[styles.statusTitle, { color: colors.text }]}>
          {region.label}
        </Text>
        <Text style={[styles.selectedSubtitle, { color: colors.muted }]}>
          {region.subtitle}
        </Text>
        <Text style={[styles.statusBody, { color: colors.muted }]}>
          {region.body}
        </Text>

        {region.ready && region.signalPercent !== null ? (
          <View style={styles.selectedScoreRow}>
            <Text style={[styles.selectedScore, { color: colors.text }]}>
              {region.signalPercent}
              <Text style={styles.selectedScoreSign}> / 100</Text>
            </Text>
            {(() => {
              const tier = getScoreTier(region.signalPercent, theme.colors);
              return (
                <View
                  style={[
                    styles.tierPill,
                    { backgroundColor: withAlpha(tier.color, 0.16) },
                  ]}
                >
                  <Text style={[styles.tierPillText, { color: tier.color }]}>
                    {tier.label}
                  </Text>
                </View>
              );
            })()}
            <View style={styles.selectedAnalyticsRow}>
              <Text style={[styles.learnMoreText, { color: accent }]}>
                View analytics
              </Text>
              <ChevronRight size={16} color={accent} />
            </View>
          </View>
        ) : freeLocked ? (
          // Blank bars, not a scrim over invented numbers: a dimmed "72 / 100"
          // still reads as this user's score. They stay still — a sweep would
          // claim the score is loading, and it isn't. The prompt sits centred
          // over them rather than below, so it reads as the gate and not as the
          // next row in the card.
          <View
            style={[
              styles.lockedScoreWrap,
              {
                backgroundColor: withAlpha(colors.outline, 0.08),
                borderColor: withAlpha(colors.outline, 0.16),
              },
            ]}
          >
            <View style={styles.lockedScoreSkeleton} pointerEvents="none">
              <View style={styles.lockedScoreSkeletonRow}>
                <View
                  style={[
                    styles.lockedScoreBar,
                    { backgroundColor: lockedSkeletonColor },
                  ]}
                />
                <View
                  style={[
                    styles.lockedTierBar,
                    { backgroundColor: lockedSkeletonColor },
                  ]}
                />
              </View>
              <View
                style={[
                  styles.lockedMeterBar,
                  { backgroundColor: lockedSkeletonColor },
                ]}
              />
            </View>
            <View pointerEvents="box-none" style={styles.lockedUpgradeOverlay}>
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel="Upgrade to see full insights"
                onPress={handleUpgrade}
                style={({ pressed }) => [
                  styles.lockedUpgradePill,
                  {
                    backgroundColor: colors.card,
                    borderColor: withAlpha(accent, 0.32),
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Image
                  accessibilityIgnoresInvertColors
                  source={LOCK_ICON}
                  style={styles.lockedLockIcon}
                />
                <Text style={[styles.lockedText, { color: accent }]}>
                  Upgrade to see full insights
                </Text>
              </HapticPressable>
            </View>
          </View>
        ) : null}
        </Animated.View>
      </HapticPressable>
    );
  };

  // A compact ranked row in the region list. Tapping selects the region
  // (updating the selected card above); it does not open the modal.
  const renderRegionRow = (region: CarouselRegion, index: number) => {
    const isSelected = region.id === selectedRegionId;
    const isLast = index === carouselRegions.length - 1;

    return (
      <HapticPressable
        key={region.id}
        accessibilityRole="button"
        accessibilityLabel={`${region.label}${
          region.ready && region.signalPercent !== null
            ? `, ${region.signalPercent}%`
            : ''
        }`}
        onPress={() => selectRegion(region.id)}
        style={({ pressed }) => [
          styles.row,
          !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: withAlpha(colors.outline, 0.16),
          },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[styles.rowRank, { color: isSelected ? accent : colors.muted }]}
        >
          {index + 1}
        </Text>
        <View style={styles.rowCopy}>
          <Text
            style={[
              styles.rowTitle,
              { color: isSelected ? accent : colors.text },
            ]}
            numberOfLines={1}
          >
            {region.label}
          </Text>
          <Text
            style={[styles.rowSubtitle, { color: colors.muted }]}
            numberOfLines={1}
          >
            {region.subtitle}
          </Text>
        </View>
        {region.ready && region.signalPercent !== null ? (
          <>
            <View
              style={[
                styles.bar,
                { backgroundColor: withAlpha(colors.outline, 0.16) },
              ]}
            >
              <View
                style={[
                  styles.barFill,
                  { backgroundColor: accent, width: `${region.signalPercent}%` },
                ]}
              />
            </View>
            <Text style={[styles.rowValue, { color: colors.text }]}>
              {region.signalPercent}
            </Text>
          </>
        ) : (
          <ChevronRight size={16} color={colors.muted} />
        )}
      </HapticPressable>
    );
  };

  // Slide 2: the selected-region card on top + a compact ranked region list
  // with a sliding highlight that tracks the selected row.
  const renderRegionList = () => (
    <>
      {renderSelectedCard()}
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>
        All regions
      </Text>
      <View style={styles.rowList}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.rowHighlight,
            {
              backgroundColor: withAlpha(accent, 0.1),
              borderColor: withAlpha(accent, 0.35),
              transform: [{ translateY: selectorY }],
            },
          ]}
        />
        {carouselRegions.map((region, index) =>
          renderRegionRow(region, index),
        )}
      </View>
    </>
  );

  // Two-page horizontal pager (building slide + region list) shown before the
  // active-days threshold is met.
  const renderPager = () => (
    <View style={styles.pagerWrap}>
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handlePagerScroll}
        scrollEventThrottle={16}
      >
        <View style={{ width: windowWidth }}>
          <ScrollView
            contentContainerStyle={styles.pagerPageContent}
            showsVerticalScrollIndicator={false}
          >
            {renderBuildingCard()}
          </ScrollView>
        </View>
        <View style={{ width: windowWidth }}>
          <ScrollView
            contentContainerStyle={styles.pagerPageContent}
            showsVerticalScrollIndicator={false}
          >
            {renderRegionList()}
          </ScrollView>
        </View>
      </ScrollView>
      <View style={[styles.dotsRow, { paddingBottom: insets.bottom + 8 }]}>
        {[0, 1].map(index => (
          <View
            key={index}
            style={[
              styles.dot,
              index === pageIndex ? styles.dotActive : null,
              {
                backgroundColor:
                  index === pageIndex
                    ? accent
                    : withAlpha(colors.outline, 0.3),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderVerticalPanel = (children: ReactNode) => (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={[
        styles.panelContent,
        { paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );

  const renderPanel = () => {
    if (panelState === 'error') {
      return renderVerticalPanel(
        <View
          testID="mind-map-error-card"
          style={[
            styles.errorCard,
            {
              backgroundColor: colors.card,
              borderColor: withAlpha(theme.colors.destructive, 0.24),
            },
          ]}
        >
          <View
            style={[
              styles.errorIcon,
              { backgroundColor: withAlpha(theme.colors.destructive, 0.12) },
            ]}
          >
            <AlertCircle color={theme.colors.destructive} size={22} />
          </View>
          <Text style={[styles.errorHeadline, { color: colors.text }]}>
            We could not load your Mind Map
          </Text>
          <Text style={[styles.errorBody, { color: colors.muted }]}>
            {error ?? 'We could not load your Mind Map right now.'}
          </Text>
          <HapticPressable
            accessibilityLabel="Retry Mind Map"
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading }}
            disabled={isLoading}
            onPress={handleRetry}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.errorRetryButton,
              { backgroundColor: accent },
              pressed && styles.pressed,
            ]}
          >
            <RefreshCw color={onAccent} size={14} />
            <Text style={[styles.primaryButtonText, { color: onAccent }]}>
              Retry
            </Text>
          </HapticPressable>
        </View>,
      );
    }

    if (panelState === 'support-first' && mindMap?.status === 'support_first') {
      return renderVerticalPanel(
        <View style={styles.stateBlock}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>
            {mindMap.period.label}
          </Text>
          <Text style={[styles.stateHeadline, { color: colors.text }]}>
            {mindMap.summary.headline}
          </Text>
          <Text style={[styles.stateBody, { color: colors.muted }]}>
            {mindMap.support.headline}
          </Text>
          <Text style={[styles.supportText, { color: colors.text }]}>
            {mindMap.support.body}
          </Text>
        </View>,
      );
    }

    if (panelState === 'loading') {
      return renderVerticalPanel(renderLoadingCards());
    }

    // Before the threshold: swipeable building slide + region list.
    if (panelState === 'building') {
      return renderPager();
    }

    // Threshold met: just the vertical region list, no horizontal sliding.
    return renderVerticalPanel(renderRegionList());
  };


  // Numbered pins should appear in every state, so fall back to the neutral
  // educational region set whenever there's no premium ready payload.
  const sceneRegions = readyMap ? nativeRegions : educationalNativeRegions;
  const graphPalette = { ...colors, node: accent, nodeHot: accent, edgeActive: accent };

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
            <HapticPressable
              accessibilityLabel="Back"
              onPress={handleBack}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: withAlpha(accent, 0.1),
                  borderColor: withAlpha(accent, 0.18),
                },
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft color={colors.text} size={18} />
            </HapticPressable>
          ) : (
            <View style={styles.iconButtonSpacer} />
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Mind Map
          </Text>
          {/* Recenter now lives inside the 3D view (top-right); keep the header
              balanced so the title stays centered. */}
          <View style={styles.iconButtonSpacer} />
        </View>

        <Text style={[styles.screenSubtitle, { color: colors.muted }]}>
          All-time reflection analytics
        </Text>

        <View
          style={[
            styles.sceneFrame,
            {
              borderColor: withAlpha(colors.outline, 0.12),
            },
          ]}
        >
          <WebMindMapView
            cameraResetToken={cameraResetToken}
            graphPalette={graphPalette}
            onReady={() => setModelReady(true)}
            onRegionPress={(event: NativeMindMapRegionPressEvent) => {
              const regionId = event.nativeEvent
                .regionId as BrainReflectionCenterId;
              selectRegion(regionId);
            }}
            reduceMotionEnabled={reduceMotionEnabled}
            regions={sceneRegions}
            selectedRegionId={selectedRegionId}
            style={styles.nativeScene}
            themeMode={theme.mode}
          />
          <HapticPressable
            accessibilityLabel="Recenter Mind Map"
            accessibilityRole="button"
            onPress={() => setCameraResetToken(token => token + 1)}
            style={({ pressed }) => [
              styles.sceneRecenterButton,
              {
                backgroundColor: withAlpha(colors.card, 0.88),
                borderColor: withAlpha(accent, 0.24),
              },
              pressed && styles.pressed,
            ]}
          >
            <RotateCcw color={accent} size={16} />
          </HapticPressable>
          <View pointerEvents="none" style={styles.sceneHintWrap}>
            <Text style={[styles.sceneHint, { color: colors.muted }]}>
              {isEducationalMode
                ? 'Drag to rotate · tap a region to learn'
                : 'Drag to rotate · pinch to zoom · tap a region'}
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Animated.View
            key={panelState}
            style={[
              styles.panelTransition,
              {
                opacity: panelReveal,
                transform: [
                  {
                    translateY: panelReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {renderPanel()}
          </Animated.View>
        </View>
      </Animated.View>

      <MindMapRegionDetailModal
        visible={modalVisible}
        region={modalRegion}
        series={series}
        seriesLoading={seriesLoading}
        locked={isEducationalMode && !modalSignalAvailable}
        signalPending={signalPending}
        reduceMotionEnabled={reduceMotionEnabled}
        onUpgrade={handleUpgrade}
        onDismiss={() => setModalVisible(false)}
      />
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
    fontWeight: '700',
  },
  sceneRecenterButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeControl: {
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
  },
  rangePill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sceneFrame: {
    marginHorizontal: 16,
    height: 300,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
  },
  nativeScene: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sceneHintWrap: {
    position: 'absolute',
    right: 16,
    bottom: 14,
  },
  sceneHint: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  panel: {
    flex: 1,
    marginTop: 14,
  },
  panelTransition: {
    flex: 1,
  },
  panelScroll: {
    flex: 1,
  },
  panelContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  pagerWrap: {
    flex: 1,
  },
  pagerPageContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  skeletonStack: {
    gap: 12,
  },
  skeletonCard: {
    gap: 10,
  },
  shimmerBlock: {
    overflow: 'hidden',
  },
  shimmerSheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 92,
    opacity: 0.82,
  },
  skeletonEyebrow: {
    width: 74,
    height: 10,
    borderRadius: 999,
  },
  skeletonTitle: {
    width: '74%',
    height: 24,
    borderRadius: 8,
  },
  skeletonSubtitle: {
    width: '44%',
    height: 13,
    borderRadius: 999,
  },
  skeletonBodyLine: {
    width: '100%',
    height: 13,
    borderRadius: 999,
    marginTop: 4,
  },
  skeletonBodyLineShort: {
    width: '68%',
    height: 13,
    borderRadius: 999,
  },
  skeletonScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  skeletonScore: {
    width: 92,
    height: 30,
    borderRadius: 9,
  },
  skeletonPill: {
    width: 76,
    height: 24,
    borderRadius: 999,
  },
  skeletonRegionCard: {
    gap: 10,
  },
  skeletonSectionLabel: {
    width: 88,
    height: 11,
    borderRadius: 999,
    marginBottom: 4,
  },
  skeletonRegionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: ROW_HEIGHT,
  },
  skeletonRank: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  skeletonRegionCopy: {
    flex: 1,
    gap: 6,
  },
  skeletonRegionTitle: {
    width: '74%',
    height: 13,
    borderRadius: 999,
  },
  skeletonRegionSubtitle: {
    width: '48%',
    height: 10,
    borderRadius: 999,
  },
  skeletonValue: {
    width: 42,
    height: 12,
    borderRadius: 999,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  heroNumber: {
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 54,
  },
  heroPercent: {
    fontSize: 26,
    letterSpacing: -0.6,
    fontWeight: '700',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTopCopy: {
    flex: 1,
    gap: 4,
  },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  trendChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  regionName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 10,
  },
  regionSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  regionBody: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  evidenceBlock: {
    marginTop: 14,
    gap: 9,
  },
  evidenceLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 2,
  },
  quoteText: {
    fontSize: 13.5,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  patternItem: {
    marginTop: 14,
    gap: 6,
  },
  patternHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  patternLabel: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  patternCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  patternRationale: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  summaryLine: {
    fontSize: 13,
    lineHeight: 20,
    marginHorizontal: 2,
  },
  summaryStrong: {
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
    marginHorizontal: 2,
  },
  detailCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  regionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowList: {
    position: 'relative',
  },
  rowHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
  },
  rowRank: {
    fontSize: 12,
    fontWeight: '600',
    width: 14,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  bar: {
    width: 44,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  rowValue: {
    fontSize: 12.5,
    fontWeight: '600',
    width: 34,
    textAlign: 'right',
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  tierPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tierPillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tierHeadline: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  tierBlurb: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 4,
  },
  footnote: {
    fontSize: 11,
    lineHeight: 17,
    marginHorizontal: 2,
    marginTop: 6,
  },
  stateBlock: {
    gap: 12,
    paddingTop: 8,
  },
  stateHeadline: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  stateBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  errorCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
    padding: 20,
  },
  errorIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorHeadline: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
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
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
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
  errorRetryButton: {
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 112,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
  screenSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 12,
    marginTop: -4,
  },
  statusTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  statusBody: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  progressBlock: {
    marginTop: 16,
    gap: 8,
  },
  progressTrack: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 6,
  },
  progressCount: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  progressCaption: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
  },
  selectedSubtitle: {
    fontSize: 12.5,
    fontWeight: '400',
    marginTop: 2,
  },
  selectedScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  selectedScore: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1,
  },
  selectedScoreSign: {
    fontSize: 17,
    fontWeight: '700',
  },
  selectedAnalyticsRow: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lockedScoreWrap: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    overflow: 'hidden',
    padding: 16,
  },
  lockedScoreSkeleton: {
    gap: 8,
  },
  lockedScoreSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lockedScoreBar: {
    width: 90,
    height: 26,
    borderRadius: 8,
  },
  lockedTierBar: {
    width: 72,
    height: 20,
    borderRadius: 999,
  },
  lockedMeterBar: {
    width: '60%',
    height: 10,
    borderRadius: 999,
  },
  lockedUpgradeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedUpgradePill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  lockedLockIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  lockedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
  },
});
