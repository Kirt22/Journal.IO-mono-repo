import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { Text } from '../infrastructure/reactNative';
import { getBrainMapColors, withAlpha } from '../features/brainMap3D/brainMapTheme';
import type { MindMapNativeRegion } from '../features/brainMap3D/mindMapRegionTypes';
import { getScoreTier } from '../features/brainMap3D/regionTier';
import WebMindMapView, {
  type MindMapSharePin,
} from '../features/brainMap3D/webRenderer/WebMindMapView';
import type { BrainReflectionCenterId } from '../services/guidedReflectionService';
import { MIND_MAP_CARD_CAPTURE_OPTIONS } from '../services/mindMapCardCapture';
import { useTheme } from '../theme/provider';
import { fontFamilies } from '../theme/typography';

export type MindMapShareRegion = {
  regionId: BrainReflectionCenterId;
  label: string;
  /** Anatomical name. Feeds the scene's pin subtitle; not drawn on the card. */
  brainRegion: string;
  scorePercent: number;
  shortInsight: string;
};

type Props = {
  onReadyChange?: (ready: boolean) => void;
  onRenderError?: () => void;
  region: MindMapShareRegion;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const SNAPSHOT_TIMEOUT_MS = 6000;
const PIN_SIZE = 24;

const MindMapShareCard = forwardRef<ViewShotRef, Props>(
  ({ onReadyChange, onRenderError, region, style, testID }, ref) => {
    const theme = useTheme();
    const graph = getBrainMapColors(theme);
    const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
    const [pin, setPin] = useState<MindMapSharePin | null>(null);
    const [brainFrame, setBrainFrame] = useState({ height: 0, width: 0 });
    const [captureToken, setCaptureToken] = useState(1);
    const hasRetriedRef = useRef(false);
    const score = Math.max(0, Math.min(100, Math.round(region.scorePercent)));
    const tier = getScoreTier(score, theme.colors);
    const accent = graph.edgeActive;
    const nativeRegions = useMemo<MindMapNativeRegion[]>(
      () => [
        {
          confidence: 1,
          id: region.regionId,
          intensity: score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low',
          isStrongest: true,
          label: region.label,
          rank: 1,
          signalScore: score / 100,
          subtitle: region.brainRegion,
        },
      ],
      [region.brainRegion, region.label, region.regionId, score],
    );

    useEffect(() => {
      setSnapshotUri(null);
      setPin(null);
      hasRetriedRef.current = false;
      setCaptureToken(token => token + 1);
      onReadyChange?.(false);
    }, [onReadyChange, region.regionId]);

    // One retry covers a scene that was still warming up; after that the card
    // cannot be produced and the caller needs to say so rather than share a
    // blank frame.
    useEffect(() => {
      if (snapshotUri) {
        return undefined;
      }

      const timer = setTimeout(() => {
        if (hasRetriedRef.current) {
          onRenderError?.();
          return;
        }
        hasRetriedRef.current = true;
        setCaptureToken(token => token + 1);
      }, SNAPSHOT_TIMEOUT_MS);

      return () => clearTimeout(timer);
    }, [captureToken, onRenderError, snapshotUri]);

    const handleShareSnapshot = useCallback(
      (dataUri: string, snapshotPin: MindMapSharePin | null) => {
        setPin(snapshotPin);
        setSnapshotUri(dataUri);
      },
      [],
    );

    // The scene renders at exactly this frame's aspect ratio, so the image fills
    // it edge to edge and the pin's normalized coordinates map straight on with
    // no contain-fit arithmetic.
    const handleBrainLayout = useCallback((event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;
      setBrainFrame(current =>
        Math.round(current.width) === Math.round(width) &&
        Math.round(current.height) === Math.round(height)
          ? current
          : { height, width },
      );
    }, []);
    const brainAspect =
      brainFrame.height > 0 ? brainFrame.width / brainFrame.height : 0;

    return (
      <ViewShot
        ref={ref}
        options={MIND_MAP_CARD_CAPTURE_OPTIONS}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderColor: withAlpha(theme.colors.foreground, 0.1),
          },
          style,
        ]}
      >
        <View collapsable={false} style={styles.content} testID={testID}>
          <View style={styles.brandRow}>
            <Text style={[styles.wordmark, { color: theme.colors.foreground }]}>
              journal
              <Text
                style={[styles.wordmarkIo, { color: theme.colors.primary }]}
              >
                .io
              </Text>
            </Text>
          </View>

          {/* No frame, no fill: the brain is the visual, so it gets the whole
              area rather than floating inside a tinted box. */}
          <View onLayout={handleBrainLayout} style={styles.brainArea}>
            {snapshotUri ? (
              <>
                <Image
                  accessibilityIgnoresInvertColors
                  onError={onRenderError}
                  onLoad={() => onReadyChange?.(true)}
                  resizeMode="contain"
                  source={{ uri: snapshotUri }}
                  style={styles.brainImage}
                />
                {pin?.visible ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.pin,
                      {
                        backgroundColor: accent,
                        left: `${pin.x * 100}%`,
                        top: `${pin.y * 100}%`,
                      },
                    ]}
                  >
                    <Text style={styles.pinText}>{pin.rank}</Text>
                  </View>
                ) : null}
              </>
            ) : brainAspect > 0 ? (
              // Unmounted the moment the snapshot lands: a live WKWebView inside
              // the tree makes view-shot's drawViewHierarchyInRect fail outright.
              <View pointerEvents="none" style={styles.hiddenScene}>
                <WebMindMapView
                  graphPalette={graph}
                  onSceneError={onRenderError}
                  onShareSnapshot={handleShareSnapshot}
                  presentationMode="share"
                  reduceMotionEnabled
                  regions={nativeRegions}
                  selectedRegionId={region.regionId}
                  shareCaptureAspect={brainAspect}
                  shareCaptureToken={captureToken}
                  style={styles.hiddenSceneView}
                  themeMode={theme.mode}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.signalCopy}>
            <Text
              numberOfLines={1}
              style={[styles.regionLabel, { color: theme.colors.foreground }]}
            >
              {region.label}
            </Text>

            <View style={styles.scoreRow}>
              <Text style={[styles.score, { color: accent }]}>{score}</Text>
              <Text
                style={[
                  styles.scoreOutOf,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {' '}
                / 100
              </Text>
              <View
                style={[
                  styles.tierChip,
                  { backgroundColor: withAlpha(tier.color, 0.14) },
                ]}
              >
                <Text style={[styles.tierChipText, { color: tier.color }]}>
                  {tier.label}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.meterTrack,
                { backgroundColor: withAlpha(theme.colors.foreground, 0.08) },
              ]}
            >
              <View
                style={[
                  styles.meterFill,
                  { backgroundColor: accent, width: `${score}%` },
                ]}
              />
            </View>

            <Text
              numberOfLines={3}
              style={[styles.insight, { color: theme.colors.mutedForeground }]}
            >
              {region.shortInsight}
            </Text>
          </View>
        </View>
      </ViewShot>
    );
  },
);

MindMapShareCard.displayName = 'MindMapShareCard';

const styles = StyleSheet.create({
  card: {
    aspectRatio: 4 / 5,
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 20,
    letterSpacing: -0.8,
    lineHeight: 24,
  },
  wordmarkIo: {
    fontFamily: fontFamilies.display.bold,
  },
  // No minHeight: the copy block below sizes itself first, and the brain takes
  // whatever is left. A floor here pushed the last line off the bottom.
  brainArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginTop: 6,
    position: 'relative',
  },
  brainImage: {
    height: '100%',
    width: '100%',
  },
  pin: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    borderWidth: 2,
    height: PIN_SIZE,
    justifyContent: 'center',
    marginLeft: -PIN_SIZE / 2,
    marginTop: -PIN_SIZE / 2,
    position: 'absolute',
    width: PIN_SIZE,
  },
  pinText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  signalCopy: {
    alignItems: 'flex-start',
    marginTop: 14,
  },
  regionLabel: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 23,
    letterSpacing: -0.65,
    lineHeight: 28,
  },
  scoreRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    marginTop: 4,
  },
  score: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 36,
    letterSpacing: -1.2,
    lineHeight: 41,
  },
  scoreOutOf: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  tierChip: {
    borderRadius: 999,
    marginLeft: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tierChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  meterTrack: {
    borderRadius: 999,
    height: 5,
    marginTop: 9,
    overflow: 'hidden',
    width: '100%',
  },
  meterFill: {
    borderRadius: 999,
    height: '100%',
  },
  insight: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 11,
  },
  hiddenScene: {
    bottom: 0,
    left: 0,
    opacity: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  hiddenSceneView: {
    backgroundColor: 'transparent',
    height: '100%',
    width: '100%',
  },
});

export default MindMapShareCard;
