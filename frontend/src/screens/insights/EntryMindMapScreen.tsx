import HapticPressable from '../../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import {
  ArrowLeft,
  Lock,
  RotateCcw,
  Share2,
  Sparkles,
  X,
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
import {
  getEntryMindMap,
  type MindMapEntry,
  type MindMapEntryReady,
} from '../../services/insightsService';
import { ApiError } from '../../utils/apiClient';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import JournalLoader from '../../components/JournalLoader';
import MindMapShareCaptureModal from '../../components/MindMapShareCaptureModal';
import type { MindMapShareRegion } from '../../components/MindMapShareCard';

type Props = {
  journalId: string;
  onBack: () => void;
  onContinue: () => void;
  onUpgrade: () => void;
};

const PREVIEW_NODE_STYLE_KEYS = [
  'previewNode0',
  'previewNode1',
  'previewNode2',
  'previewNode3',
  'previewNode4',
] as const;

function formatSignalPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildNativeRegions(ready: MindMapEntryReady): MindMapNativeRegion[] {
  return ready.regions.map(region => ({
    id: region.id,
    label: region.productLabel,
    subtitle: region.brainRegionSubtitle,
    signalScore: region.signalScore,
    confidence: region.confidence,
    intensity: region.intensity,
    isStrongest: region.id === ready.strongestRegionId,
    rank: region.rank,
  }));
}

function maskEvidence(snippets: string[], hidePreviews: boolean) {
  if (!hidePreviews) {
    return snippets;
  }

  return snippets.map(() => 'Preview hidden by your entry privacy setting.');
}

export default function EntryMindMapScreen({
  journalId,
  onBack,
  onContinue,
  onUpgrade,
}: Props) {
  const theme = useTheme();
  const colors = getBrainMapColors(theme);
  const insets = useSafeAreaInsets();
  const hideJournalPreviews = useAppStore(state => state.hideJournalPreviews);
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );

  const [entryMap, setEntryMap] = useState<MindMapEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gated, setGated] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [shareRegion, setShareRegion] = useState<MindMapShareRegion | null>(null);
  const refineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) {
        setReduceMotionEnabled(value);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const loadEntryMap = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!isPremiumUser) {
        setEntryMap(null);
        setError(null);
        setGated(true);
        setIsLoading(false);
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      setGated(false);

      try {
        const result = await getEntryMindMap(journalId);
        setEntryMap(result);

        if (result.status === 'ready') {
          setSelectedRegionId(current => current ?? result.strongestRegionId);
        }
      } catch (caught) {
        if (
          caught instanceof ApiError &&
          caught.code === 'PREMIUM_REQUIRED'
        ) {
          setGated(true);
        } else {
          setError(
            "We couldn't load this entry's Mind Map. Please try again.",
          );
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [isPremiumUser, journalId],
  );

  useEffect(() => {
    loadEntryMap();
  }, [loadEntryMap]);

  // While the map is still heuristic, the AI upgrade may land shortly after
  // save. Refetch once quietly so the user sees the refined map without action.
  useEffect(() => {
    if (
      entryMap?.status === 'ready' &&
      entryMap.refining &&
      !refineTimer.current
    ) {
      refineTimer.current = setTimeout(() => {
        refineTimer.current = null;
        loadEntryMap({ silent: true });
      }, 4500);
    }

    return () => {
      if (refineTimer.current) {
        clearTimeout(refineTimer.current);
        refineTimer.current = null;
      }
    };
  }, [entryMap, loadEntryMap]);

  const readyMap = entryMap?.status === 'ready' ? entryMap : null;
  const nativeRegions = useMemo(
    () => (readyMap ? buildNativeRegions(readyMap) : []),
    [readyMap],
  );
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
  const selectedShareRegion = useMemo<MindMapShareRegion | null>(
    () =>
      selectedRegion
        ? {
            brainRegion: selectedRegion.brainRegionSubtitle,
            label: selectedRegion.productLabel,
            regionId: selectedRegion.id,
            scorePercent: Math.round(selectedRegion.signalScore * 100),
            shortInsight: selectedRegion.shortInsight,
          }
        : null,
    [selectedRegion],
  );

  const renderHeader = () => (
    <View style={styles.headerRow}>
      <HapticPressable
        accessibilityLabel={gated ? 'Close' : 'Back'}
        onPress={onBack}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: withAlpha(colors.nodeHot, 0.1),
            borderColor: withAlpha(colors.nodeHot, 0.18),
          },
          pressed && styles.pressed,
        ]}
      >
        {gated ? (
          <X color={colors.text} size={18} />
        ) : (
          <ArrowLeft color={colors.text} size={18} />
        )}
      </HapticPressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        Entry Mind Map
      </Text>
      {readyMap ? (
        <HapticPressable
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
        </HapticPressable>
      ) : (
        <View style={styles.iconButtonSpacer} />
      )}
    </View>
  );

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.centerState}>
          <JournalLoader color={colors.nodeHot} />
          <Text style={[styles.centerStateText, { color: colors.muted }]}>
            Reading this entry's signal…
          </Text>
        </View>
      );
    }

    if (gated) {
      return (
        <View style={styles.gatedState}>
          <View
            accessibilityLabel="Blurred Mind Map preview"
            style={[
              styles.gatedPreview,
              {
                backgroundColor: withAlpha(colors.outline, 0.07),
                borderColor: withAlpha(colors.outline, 0.16),
              },
            ]}
          >
            <View style={styles.previewHeader}>
              <View
                style={[
                  styles.previewOrb,
                  { backgroundColor: withAlpha(colors.nodeHot, 0.24) },
                ]}
              />
              <View style={styles.previewHeaderLines}>
                <View
                  style={[
                    styles.previewLine,
                    styles.previewLineWide,
                    { backgroundColor: withAlpha(colors.text, 0.16) },
                  ]}
                />
                <View
                  style={[
                    styles.previewLine,
                    styles.previewLineShort,
                    { backgroundColor: withAlpha(colors.text, 0.1) },
                  ]}
                />
              </View>
            </View>
            <View style={styles.previewMap}>
              {PREVIEW_NODE_STYLE_KEYS.map((styleKey, index) => (
                <View
                  key={styleKey}
                  style={[
                    styles.previewNode,
                    styles[styleKey],
                    {
                      backgroundColor: withAlpha(
                        index % 2 ? colors.outline : colors.nodeHot,
                        0.18,
                      ),
                    },
                  ]}
                />
              ))}
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.previewScrim,
                { backgroundColor: withAlpha(colors.background, 0.84) },
              ]}
            />
            <View pointerEvents="none" style={styles.previewLock}>
              <View
                style={[
                  styles.previewLockIcon,
                  { backgroundColor: withAlpha(colors.nodeHot, 0.14) },
                ]}
              >
                <Lock color={colors.nodeHot} size={20} />
              </View>
            </View>
          </View>
          <Text style={[styles.centerStateTitle, { color: colors.text }]}>
            Your Mind Map is ready to unfold
          </Text>
          <Text style={[styles.centerStateText, { color: colors.muted }]}>
            Go Pro to reveal the patterns and reflection signals connected to this entry.
          </Text>
          {!isPremiumUser ? (
            <HapticPressable
              accessibilityLabel="Unlock Mind Map with Pro"
              accessibilityRole="button"
              onPress={onUpgrade}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.nodeHot },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: theme.colors.primaryForeground },
                ]}
              >
                See my Mind Map with Pro
              </Text>
            </HapticPressable>
          ) : null}
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerState}>
          <Text style={[styles.centerStateText, { color: colors.muted }]}>
            {error}
          </Text>
          <HapticPressable
            accessibilityRole="button"
            onPress={() => loadEntryMap()}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.12),
                borderColor: withAlpha(colors.nodeHot, 0.22),
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.retryText, { color: colors.text }]}>
              Try again
            </Text>
          </HapticPressable>
        </View>
      );
    }

    if (entryMap?.status === 'support_first') {
      return (
        <View style={styles.centerState}>
          <Text style={[styles.centerStateTitle, { color: colors.text }]}>
            {entryMap.support.headline}
          </Text>
          <Text style={[styles.centerStateText, { color: colors.muted }]}>
            {entryMap.support.body}
          </Text>
          <Text style={[styles.centerStateNote, { color: colors.muted }]}>
            {entryMap.support.note}
          </Text>
        </View>
      );
    }

    if (!readyMap || !selectedRegion) {
      return null;
    }

    return (
      <>
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
            <WebMindMapView
              cameraResetToken={cameraResetToken}
              graphPalette={colors}
              onRegionPress={(event: NativeMindMapRegionPressEvent) =>
                setSelectedRegionId(event.nativeEvent.regionId)
              }
              reduceMotionEnabled={reduceMotionEnabled}
              regions={nativeRegions}
              selectedRegionId={selectedRegionId}
              style={styles.nativeScene}
              themeMode={theme.mode}
            />
            <View pointerEvents="none" style={styles.sceneHintWrap}>
              <Text style={[styles.sceneHint, { color: colors.muted }]}>
                Drag to rotate · pinch to zoom · tap a region
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.seedText, { color: colors.muted }]}>
            {readyMap.summary.seedText}
          </Text>
          <Text style={[styles.headline, { color: colors.text }]}>
            {readyMap.summary.headline}
          </Text>
          <Text style={[styles.narrative, { color: colors.muted }]}>
            {readyMap.summary.narrative}
          </Text>

          <View
            style={[
              styles.tierCard,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.08),
                borderColor: withAlpha(colors.nodeHot, 0.18),
              },
            ]}
          >
            <Text style={[styles.tierEyebrow, { color: colors.nodeHot }]}>
              Reflection style
            </Text>
            <Text style={[styles.tierLabel, { color: colors.text }]}>
              {readyMap.overallTier.label}
            </Text>
            <Text style={[styles.tierBlurb, { color: colors.muted }]}>
              {readyMap.overallTier.blurb}
            </Text>
          </View>

          {readyMap.refining ? (
            <View
              style={[
                styles.refiningChip,
                { backgroundColor: withAlpha(colors.outline, 0.08) },
              ]}
            >
              <Sparkles size={14} color={colors.muted} />
              <Text style={[styles.refiningText, { color: colors.muted }]}>
                Refining this map with AI…
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.detailCard,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.08),
                borderColor: withAlpha(colors.nodeHot, 0.18),
              },
            ]}
          >
            <View style={styles.regionHeading}>
              <Text style={[styles.regionTitle, { color: colors.text }]}>
                {selectedRegion.productLabel}
              </Text>
              {selectedShareRegion ? (
                <HapticPressable
                  accessibilityLabel="Share selected Mind Map region"
                  accessibilityRole="button"
                  onPress={() => setShareRegion(selectedShareRegion)}
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
            </View>
            <Text style={[styles.regionSubtitle, { color: colors.muted }]}>
              {selectedRegion.brainRegionSubtitle}
            </Text>
            <Text style={[styles.regionBody, { color: colors.muted }]}>
              {selectedRegion.shortInsight}
            </Text>
            {maskEvidence(selectedRegion.evidenceSnippets, hideJournalPreviews)
              .length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>
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
              </>
            ) : null}
          </View>

          {(readyMap.patterns ?? []).length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                What stood out
              </Text>
              {(readyMap.patterns ?? []).map(pattern => {
                const quote = hideJournalPreviews
                  ? 'Preview hidden by your entry privacy setting.'
                  : pattern.evidenceQuote;

                return (
                  <View
                    key={pattern.id}
                    style={[
                      styles.detailCard,
                      {
                        backgroundColor: withAlpha(colors.outline, 0.05),
                        borderColor: withAlpha(colors.outline, 0.14),
                      },
                    ]}
                  >
                    <Text style={[styles.regionTitle, { color: colors.text }]}>
                      {pattern.label}
                    </Text>
                    {pattern.rationale ? (
                      <Text style={[styles.regionBody, { color: colors.muted }]}>
                        {pattern.rationale}
                      </Text>
                    ) : null}
                    {quote ? (
                      <View
                        style={[
                          styles.evidenceChip,
                          { backgroundColor: withAlpha(colors.outline, 0.08) },
                        ]}
                      >
                        <Text style={[styles.evidenceText, { color: colors.text }]}>
                          “{quote}”
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </>
          ) : null}

          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            All regions
          </Text>
          {readyMap.regions.map(region => {
            const selected = region.id === selectedRegion.id;

            return (
              <HapticPressable
                key={region.id}
                accessibilityRole="button"
                accessibilityLabel={`${region.productLabel}, ${formatSignalPercent(
                  region.signalScore,
                )} signal`}
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
                <View
                  style={[
                    styles.tierRowPill,
                    { backgroundColor: withAlpha(colors.nodeHot, 0.14) },
                  ]}
                >
                  <Text
                    style={[styles.tierRowPillText, { color: colors.nodeHot }]}
                  >
                    {region.tierLabel}
                  </Text>
                </View>
                <Text style={[styles.regionButtonValue, { color: colors.text }]}>
                  {formatSignalPercent(region.signalScore)}
                </Text>
              </HapticPressable>
            );
          })}
          <HapticPressable
            accessibilityLabel="Continue to goals"
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.nodeHot },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.primaryForeground },
              ]}
            >
              Continue
            </Text>
          </HapticPressable>
        </ScrollView>
      </>
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.screen}>
        {renderHeader()}
        {renderBody()}
      </View>
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
  },
  headerRow: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSpacer: {
    width: 38,
    height: 38,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  recenterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recenterPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sceneShell: {
    height: 300,
  },
  sceneFrame: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  nativeScene: {
    flex: 1,
  },
  sceneHintWrap: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sceneHint: {
    fontSize: 12,
    fontWeight: '400',
  },
  scrollContent: {
    paddingTop: 16,
    gap: 10,
  },
  seedText: {
    fontSize: 13,
    fontWeight: '700',
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
  },
  narrative: {
    fontSize: 14,
    lineHeight: 21,
  },
  refiningChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  refiningText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  regionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  shareIconButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  regionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  regionSubtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  regionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
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
    fontWeight: '600',
  },
  tierCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 4,
    marginTop: 4,
  },
  tierEyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tierLabel: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  tierBlurb: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 2,
  },
  tierRowPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tierRowPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  disclaimerBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  gatedState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 32,
    paddingHorizontal: 8,
  },
  gatedPreview: {
    borderRadius: 24,
    borderWidth: 1,
    height: 270,
    marginBottom: 26,
    overflow: 'hidden',
    padding: 20,
    width: '100%',
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  previewOrb: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  previewHeaderLines: {
    flex: 1,
    gap: 8,
  },
  previewLine: {
    borderRadius: 999,
    height: 9,
  },
  previewLineWide: {
    width: '72%',
  },
  previewLineShort: {
    width: '44%',
  },
  previewMap: {
    flex: 1,
    marginTop: 18,
    position: 'relative',
  },
  previewNode: {
    borderRadius: 999,
    height: 54,
    position: 'absolute',
    width: 54,
  },
  previewNode0: {
    left: '42%',
    top: '34%',
  },
  previewNode1: {
    left: '14%',
    top: '12%',
  },
  previewNode2: {
    right: '12%',
    top: '8%',
  },
  previewNode3: {
    bottom: '2%',
    left: '20%',
  },
  previewNode4: {
    bottom: '4%',
    right: '20%',
  },
  previewScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  previewLock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLockIcon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  centerStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  centerStateText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  centerStateNote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 17,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 54,
    paddingHorizontal: 22,
    paddingVertical: 15,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
