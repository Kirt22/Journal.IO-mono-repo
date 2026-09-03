import HapticPressable from '../../components/HapticPressable';
import {
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
import { RotateCcw, Share2, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MindMapRegionDetailSheet from '../../components/MindMapRegionDetailSheet';
import MindMapShareCaptureModal from '../../components/MindMapShareCaptureModal';
import type { MindMapShareRegion } from '../../components/MindMapShareCard';
import { getMindMapRegionEducation } from '../../features/brainMap3D/mindMapEducation';
import WebMindMapView, {
  type NativeMindMapRegionPressEvent,
} from '../../features/brainMap3D/webRenderer/WebMindMapView';
import {
  getBrainMapColors,
  withAlpha,
} from '../../features/brainMap3D/brainMapTheme';
import type { MindMapNativeRegion } from '../../features/brainMap3D/mindMapRegionTypes';
import { getScoreTier } from '../../features/brainMap3D/regionTier';
import { triggerHaptic } from '../../services/hapticsService';
import type {
  BrainReflectionCenterId,
  GuidedReflectionSessionAnalysisResponse,
} from '../../services/guidedReflectionService';
import { useTheme } from '../../theme/provider';

type Props = {
  sessionAnalysis: GuidedReflectionSessionAnalysisResponse;
  onContinue: (selectedRegionId: BrainReflectionCenterId) => void;
  variant?: 'first' | 'session';
};

function buildSessionRegions(
  sessionAnalysis: GuidedReflectionSessionAnalysisResponse,
): MindMapNativeRegion[] {
  return sessionAnalysis.brainSessionMap.centers.map(center => ({
    id: center.id,
    label: center.productName,
    subtitle: center.brainRegion,
    signalScore: center.score,
    confidence: center.confidence,
    intensity: center.intensity,
    isStrongest: center.id === sessionAnalysis.brainSessionMap.dominantCenterId,
    rank: center.rank,
  }));
}

export default function OnboardingMindMapScreen({
  sessionAnalysis,
  onContinue,
  variant = 'first',
}: Props) {
  const theme = useTheme();
  const colors = getBrainMapColors(theme);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [selectedRegionId, setSelectedRegionId] = useState<BrainReflectionCenterId>(
    sessionAnalysis.brainSessionMap.dominantCenterId,
  );
  const [isDetailSheetVisible, setIsDetailSheetVisible] = useState(false);
  const [shareRegion, setShareRegion] = useState<MindMapShareRegion | null>(null);
  const reveal = useRef(new Animated.Value(0)).current;
  const detailCardReveal = useRef(new Animated.Value(1)).current;
  const hasSelectedRegionRef = useRef(false);
  const regions = useMemo(
    () => buildSessionRegions(sessionAnalysis),
    [sessionAnalysis],
  );
  const selectedRegion =
    sessionAnalysis.brainSessionMap.centers.find(
      center => center.id === selectedRegionId,
    ) || sessionAnalysis.brainSessionMap.dominantCenter;
  const selectedScore = Math.round(selectedRegion.score * 100);
  const selectedScoreTier = getScoreTier(selectedScore, theme.colors);
  const isSessionMap = variant === 'session';

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (isActive) {
          setReduceMotionEnabled(value);
        }
      })
      .catch(() => {
        if (isActive) {
          setReduceMotionEnabled(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduceMotionEnabled, reveal]);

  useEffect(() => {
    if (!hasSelectedRegionRef.current) {
      hasSelectedRegionRef.current = true;
      return;
    }

    if (reduceMotionEnabled) {
      detailCardReveal.setValue(1);
      return;
    }

    detailCardReveal.setValue(0);
    Animated.spring(detailCardReveal, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [detailCardReveal, reduceMotionEnabled, selectedRegionId]);

  const handleRegionPress = (event: NativeMindMapRegionPressEvent) => {
    setSelectedRegionId(event.nativeEvent.regionId as BrainReflectionCenterId);
    triggerHaptic('optionSelected').catch(() => undefined);
  };

  const handleRecenter = () => {
    setCameraResetToken(token => token + 1);
    triggerHaptic('secondaryAction').catch(() => undefined);
  };

  const handleContinue = () => {
    triggerHaptic('primaryAction').catch(() => undefined);
    onContinue(selectedRegionId);
  };

  const handleOpenDetails = () => {
    triggerHaptic('secondaryAction').catch(() => undefined);
    setIsDetailSheetVisible(true);
  };

  const selectedShareRegion: MindMapShareRegion = {
    brainRegion: selectedRegion.brainRegion,
    label: selectedRegion.productName,
    regionId: selectedRegion.id,
    scorePercent: selectedScore,
    shortInsight: selectedRegion.shortInsight,
  };

  const handleShare = () => {
    setShareRegion(selectedShareRegion);
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
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
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.nodeHot }]}>
              {isSessionMap ? 'YOUR SESSION MIND MAP' : 'YOUR FIRST MIND MAP'}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Explore what stood out
            </Text>
          </View>
          <HapticPressable
            accessibilityLabel="Recenter Mind Map"
            accessibilityRole="button"
            onPress={handleRecenter}
            style={({ pressed }) => [
              styles.recenterButton,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.1),
                borderColor: withAlpha(colors.outline, 0.2),
              },
              pressed && styles.pressed,
            ]}
          >
            <RotateCcw color={colors.nodeHot} size={17} />
          </HapticPressable>
        </View>

        <View
          style={[
            styles.sceneFrame,
            { borderColor: withAlpha(colors.outline, 0.15) },
          ]}
        >
          <WebMindMapView
            cameraResetToken={cameraResetToken}
            graphPalette={colors}
            onRegionPress={handleRegionPress}
            reduceMotionEnabled={reduceMotionEnabled}
            regions={regions}
            selectedRegionId={selectedRegionId}
            style={styles.scene}
            themeMode={theme.mode}
          />
          <View pointerEvents="none" style={styles.sceneHintWrap}>
            <Text style={[styles.sceneHint, { color: colors.muted }]}>
              Drag to rotate · pinch to zoom · tap a region
            </Text>
          </View>
        </View>

        <Animated.View
          style={{
            opacity: detailCardReveal,
            transform: [
              {
                translateY: detailCardReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
              {
                scale: detailCardReveal.interpolate({
                  inputRange: [0, 0.72, 1],
                  outputRange: [0.985, 1.025, 1],
                }),
              },
            ],
          }}
        >
          <HapticPressable
            accessibilityHint={
              isSessionMap
                ? 'Opens signal details'
                : 'Opens AI signal and area details'
            }
            accessibilityLabel={`View details for ${selectedRegion.productName}, score ${selectedScore} out of 100, ${selectedScoreTier.label}`}
            accessibilityRole="button"
            hapticEvent={false}
            onPress={handleOpenDetails}
            style={({ pressed }) => [
              styles.detailCard,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.09),
                borderColor: withAlpha(colors.nodeHot, 0.2),
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.detailHeading}>
              <Sparkles color={colors.nodeHot} size={16} />
              <Text style={[styles.detailLabel, { color: colors.muted }]}>
                {isSessionMap ? 'SESSION SIGNAL' : 'FIRST-REFLECTION SIGNAL'}
              </Text>
              {isSessionMap ? (
                <HapticPressable
                  accessibilityLabel="Share selected Mind Map region"
                  accessibilityRole="button"
                  onPress={event => {
                    event.stopPropagation();
                    handleShare();
                  }}
                  style={({ pressed }) => [
                    styles.shareIconButton,
                    {
                      backgroundColor: withAlpha(colors.nodeHot, 0.1),
                      borderColor: withAlpha(colors.nodeHot, 0.2),
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Share2 color={colors.nodeHot} size={15} />
                </HapticPressable>
              ) : null}
              <View style={styles.scoreSummary}>
                <Text style={[styles.regionScore, { color: colors.nodeHot }]}>
                  {selectedScore}
                  <Text style={[styles.regionScoreOutOf, { color: colors.muted }]}>
                    {' '}
                    / 100
                  </Text>
                </Text>
                <View
                  style={[
                    styles.tierPill,
                    {
                      backgroundColor: withAlpha(selectedScoreTier.color, 0.16),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tierPillText,
                      { color: selectedScoreTier.color },
                    ]}
                  >
                    {selectedScoreTier.label}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.regionTitle, { color: colors.text }]}>
              {selectedRegion.productName}
            </Text>
            <Text style={[styles.regionSubtitle, { color: colors.muted }]}>
              {selectedRegion.brainRegion}
            </Text>
            <Text
              numberOfLines={3}
              style={[styles.regionBody, { color: colors.muted }]}
            >
              {selectedRegion.shortInsight}
            </Text>
          </HapticPressable>
        </Animated.View>

        <HapticPressable
          accessibilityLabel={
            isSessionMap ? 'Continue to Home' : 'Continue to share your Mind Map'
          }
          accessibilityRole="button"
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.continueButton,
            { backgroundColor: theme.colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.continueText,
              { color: theme.colors.primaryForeground },
            ]}
          >
            Continue
          </Text>
        </HapticPressable>
      </Animated.View>
      <MindMapRegionDetailSheet
        education={getMindMapRegionEducation(selectedRegion.id)}
        onDismiss={() => setIsDetailSheetVisible(false)}
        region={selectedRegion}
        visible={isDetailSheetVisible}
      />
      <MindMapShareCaptureModal
        onClose={() => setShareRegion(null)}
        region={shareRegion}
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topBar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.15,
  },
  title: {
    marginTop: 3,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  recenterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneFrame: {
    flex: 1,
    minHeight: 286,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
  },
  scene: {
    flex: 1,
  },
  sceneHintWrap: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    left: 12,
    alignItems: 'center',
  },
  sceneHint: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  detailHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareIconButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  detailLabel: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.95,
  },
  regionTitle: {
    marginTop: 9,
    fontSize: 17,
    fontWeight: '700',
  },
  regionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '400',
  },
  regionScore: {
    fontSize: 13,
    fontWeight: '600',
  },
  regionScoreOutOf: {
    fontSize: 10,
    fontWeight: '600',
  },
  regionBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  continueButton: {
    minHeight: 54,
    marginTop: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scoreSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto',
  },
  tierPill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
});
